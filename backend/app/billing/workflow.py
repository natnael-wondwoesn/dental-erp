import uuid
from datetime import UTC, datetime
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.billing.schemas import ClaimCreate, InsurancePolicyCreate, InvoiceCreate, PaymentCreate
from app.common.identifiers import next_document_number
from app.models import InsuranceClaim, InsurancePolicy, Invoice, InvoiceLine, LedgerEntry, Patient, Payment


class BillingWorkflow:
    """Owns invoice arithmetic, immutable posting, receipts, balances, and ledger effects."""

    def __init__(self, session: AsyncSession, hospital_id: uuid.UUID, actor_id: uuid.UUID):
        self.session, self.hospital_id, self.actor_id = session, hospital_id, actor_id

    async def patient(self, patient_id: uuid.UUID) -> Patient:
        patient = await self.session.scalar(select(Patient).where(Patient.id == patient_id, Patient.hospital_id == self.hospital_id, Patient.is_active.is_(True)))
        if not patient:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient not found")
        return patient

    async def invoice(self, invoice_id: uuid.UUID, *, lock: bool = False) -> Invoice:
        query = select(Invoice).where(Invoice.id == invoice_id, Invoice.hospital_id == self.hospital_id)
        if lock:
            query = query.with_for_update()
        invoice = await self.session.scalar(query)
        if not invoice:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
        return invoice

    async def create_invoice(self, payload: InvoiceCreate) -> Invoice:
        await self.patient(payload.patient_id)
        subtotal = sum((line.unit_price * line.quantity for line in payload.lines), Decimal("0"))
        total = subtotal - payload.discount_amount + payload.tax_amount
        invoice = Invoice(hospital_id=self.hospital_id, patient_id=payload.patient_id, invoice_number=await next_document_number(self.session, hospital_id=self.hospital_id, key="invoice", prefix="INV"), subtotal=subtotal, discount_amount=payload.discount_amount, tax_amount=payload.tax_amount, total_amount=total, balance_due=total, status="ISSUED", issued_at=datetime.now(UTC), due_at=payload.due_at, notes=payload.notes)
        self.session.add(invoice)
        await self.session.flush()
        self.session.add_all([InvoiceLine(hospital_id=self.hospital_id, invoice_id=invoice.id, clinical_procedure_id=line.clinical_procedure_id, description=line.description, quantity=line.quantity, unit_price=line.unit_price, line_total=line.unit_price * line.quantity) for line in payload.lines])
        await self._ledger(entry_type="INCOME", account="ACCOUNTS_RECEIVABLE", description=f"Invoice {invoice.invoice_number}", debit=total, credit=Decimal("0"), source_type="INVOICE", source_id=str(invoice.id))
        await self.session.flush()
        return invoice

    async def post_payment(self, payload: PaymentCreate) -> Payment:
        invoice = None
        patient_id = payload.patient_id
        if payload.invoice_id:
            invoice = await self.invoice(payload.invoice_id, lock=True)
            patient_id = invoice.patient_id
            if invoice.status in {"VOID", "PAID"}:
                raise HTTPException(status.HTTP_409_CONFLICT, "Invoice cannot accept payments")
            if payload.amount > invoice.balance_due:
                raise HTTPException(status.HTTP_409_CONFLICT, "Payment exceeds outstanding balance")
        if patient_id is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "patientId or invoiceId is required")
        await self.patient(patient_id)
        payment = Payment(hospital_id=self.hospital_id, patient_id=patient_id, invoice_id=payload.invoice_id, receipt_number=await next_document_number(self.session, hospital_id=self.hospital_id, key="receipt", prefix="RCT"), amount=payload.amount, method=payload.method, reference=payload.reference, notes=payload.notes, posted_by=self.actor_id, received_at=datetime.now(UTC))
        self.session.add(payment)
        await self.session.flush()
        if invoice:
            invoice.balance_due -= payload.amount
            invoice.status = "PAID" if invoice.balance_due == 0 else "PARTIALLY_PAID"
        await self._ledger(entry_type="PAYMENT", account=payload.method, description=f"Receipt {payment.receipt_number}", debit=payload.amount, credit=Decimal("0"), source_type="PAYMENT", source_id=str(payment.id))
        await self._ledger(entry_type="PAYMENT", account="ACCOUNTS_RECEIVABLE", description=f"Receipt {payment.receipt_number}", debit=Decimal("0"), credit=payload.amount, source_type="PAYMENT", source_id=str(payment.id))
        await self.session.flush()
        return payment

    async def policy(self, payload: InsurancePolicyCreate) -> InsurancePolicy:
        await self.patient(payload.patient_id)
        record = InsurancePolicy(hospital_id=self.hospital_id, **payload.model_dump())
        self.session.add(record)
        await self.session.flush()
        return record

    async def claim(self, payload: ClaimCreate) -> InsuranceClaim:
        invoice = await self.invoice(payload.invoice_id)
        policy = await self.session.scalar(select(InsurancePolicy).where(InsurancePolicy.id == payload.policy_id, InsurancePolicy.hospital_id == self.hospital_id, InsurancePolicy.patient_id == payload.patient_id, InsurancePolicy.is_active.is_(True)))
        if not policy or invoice.patient_id != payload.patient_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Active patient insurance policy not found")
        if payload.claimed_amount > invoice.balance_due:
            raise HTTPException(status.HTTP_409_CONFLICT, "Claim exceeds outstanding balance")
        record = InsuranceClaim(hospital_id=self.hospital_id, claim_number=await next_document_number(self.session, hospital_id=self.hospital_id, key="insurance-claim", prefix="CLM"), **payload.model_dump())
        self.session.add(record)
        await self.session.flush()
        return record

    async def _ledger(self, *, entry_type: str, account: str, description: str, debit: Decimal, credit: Decimal, source_type: str, source_id: str) -> None:
        self.session.add(LedgerEntry(hospital_id=self.hospital_id, entry_number=await next_document_number(self.session, hospital_id=self.hospital_id, key="ledger", prefix="LED"), entry_type=entry_type, account=account, description=description, debit=debit, credit=credit, source_type=source_type, source_id=source_id, posted_at=datetime.now(UTC), posted_by=self.actor_id))
