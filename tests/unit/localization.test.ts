// @ts-nocheck
import { describe, it, expect, vi } from 'vitest'

vi.mock('@prisma/client', () => ({
  InvoiceStatus: {
    DRAFT: 'DRAFT',
    PENDING: 'PENDING',
    PARTIALLY_PAID: 'PARTIALLY_PAID',
    PAID: 'PAID',
    OVERDUE: 'OVERDUE',
    CANCELLED: 'CANCELLED',
    REFUNDED: 'REFUNDED',
  },
  PaymentMethod: {
    CASH: 'CASH',
    CARD: 'CARD',
    UPI: 'UPI',
    BANK_TRANSFER: 'BANK_TRANSFER',
    CHEQUE: 'CHEQUE',
    INSURANCE: 'INSURANCE',
    WALLET: 'WALLET',
    ONLINE: 'ONLINE',
  },
  PaymentStatus: {
    PENDING: 'PENDING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    REFUNDED: 'REFUNDED',
    CANCELLED: 'CANCELLED',
  },
  InsuranceClaimStatus: {
    DRAFT: 'DRAFT',
    SUBMITTED: 'SUBMITTED',
    UNDER_REVIEW: 'UNDER_REVIEW',
    APPROVED: 'APPROVED',
    PARTIALLY_APPROVED: 'PARTIALLY_APPROVED',
    REJECTED: 'REJECTED',
    SETTLED: 'SETTLED',
  },
  DiscountType: { PERCENTAGE: 'PERCENTAGE', FIXED: 'FIXED' },
}))

import {
  formatCurrency,
  formatDate,
  formatPhone,
  validateAadhar,
  validateIndianPhone,
  validateGSTIN,
} from '@/lib/utils'
import {
  gstConfig,
  calculateGST,
  discountTypeConfig,
  formatCurrency as billingFormatCurrency,
  numberToWords,
  formatDateTime as billingFormatDateTime,
} from '@/lib/billing-utils'

describe('Section 10.1 — Current Locale (India)', () => {
  // ─── Currency Display ───────────────────────────────────────────────

  describe('Currency Display', () => {
    it('formatCurrency from utils displays ₹ symbol', () => {
      const result = formatCurrency(500)
      expect(result).toContain('₹')
    })

    it('billingFormatCurrency displays ETB with 2 decimal places', () => {
      const result = billingFormatCurrency(500)
      expect(result).toContain('ETB')
      expect(result).toMatch(/500\.00/)
    })

    it('uses Indian number formatting — lakhs (1,00,000 not 100,000)', () => {
      const result = formatCurrency(100000)
      // en-IN formats 100000 as 1,00,000
      expect(result).toContain('1,00,000')
    })

    it('uses Indian number formatting — crores', () => {
      const result = formatCurrency(10000000)
      // en-IN formats 10000000 as 1,00,00,000
      expect(result).toContain('1,00,00,000')
    })

    it('zero amount renders as ₹0', () => {
      const result = formatCurrency(0)
      expect(result).toContain('₹')
      expect(result).toMatch(/0/)
    })

    it('large amounts use international grouping in billing', () => {
      const result = billingFormatCurrency(25000000)
      expect(result).toContain('25,000,000.00')
    })

    it('negative amounts are handled', () => {
      const result = formatCurrency(-1500)
      expect(result).toContain('₹')
      expect(result).toContain('1,500')
    })

    it('discountTypeConfig.FIXED.symbol is ETB', () => {
      expect(discountTypeConfig.FIXED.symbol).toBe('ETB')
    })
  })

  // ─── Date Format ────────────────────────────────────────────────────

  describe('Date Format', () => {
    it('formatDate uses en-IN locale', () => {
      const result = formatDate(new Date(2026, 2, 8)) // March 8, 2026
      // en-IN with day:2-digit, month:short, year:numeric => "08 Mar 2026"
      expect(result).toMatch(/08/)
      expect(result).toMatch(/Mar/)
      expect(result).toMatch(/2026/)
    })

    it('output format is DD Mon YYYY', () => {
      const result = formatDate(new Date(2026, 0, 15)) // Jan 15, 2026
      expect(result).toMatch(/15.*Jan.*2026/)
    })

    it('invalid date returns "-"', () => {
      expect(formatDate('not-a-date')).toBe('-')
    })

    it('string date input works', () => {
      const result = formatDate('2026-03-08')
      expect(result).toMatch(/Mar/)
      expect(result).toMatch(/2026/)
    })

    it('Date object input works', () => {
      const result = formatDate(new Date(2025, 11, 25)) // Dec 25, 2025
      expect(result).toMatch(/25/)
      expect(result).toMatch(/Dec/)
      expect(result).toMatch(/2025/)
    })
  })

  // ─── Phone Number Format ────────────────────────────────────────────

  describe('Phone Number Format', () => {
    it('formatPhone adds +91 prefix for 10-digit number', () => {
      const result = formatPhone('9876543210')
      expect(result).toBe('+91 98765 43210')
    })

    it('formatPhone handles 12-digit number with 91 prefix', () => {
      const result = formatPhone('919876543210')
      expect(result).toBe('+91 98765 43210')
    })

    it('validateIndianPhone accepts valid numbers starting with 6', () => {
      expect(validateIndianPhone('6123456789')).toBe(true)
    })

    it('validateIndianPhone accepts valid numbers starting with 7', () => {
      expect(validateIndianPhone('7123456789')).toBe(true)
    })

    it('validateIndianPhone accepts valid numbers starting with 8', () => {
      expect(validateIndianPhone('8123456789')).toBe(true)
    })

    it('validateIndianPhone accepts valid numbers starting with 9', () => {
      expect(validateIndianPhone('9123456789')).toBe(true)
    })

    it('validateIndianPhone rejects numbers starting with 0-5', () => {
      expect(validateIndianPhone('0123456789')).toBe(false)
      expect(validateIndianPhone('1234567890')).toBe(false)
      expect(validateIndianPhone('2345678901')).toBe(false)
      expect(validateIndianPhone('3456789012')).toBe(false)
      expect(validateIndianPhone('4567890123')).toBe(false)
      expect(validateIndianPhone('5678901234')).toBe(false)
    })

    it('validateIndianPhone rejects wrong length', () => {
      expect(validateIndianPhone('98765')).toBe(false)
      expect(validateIndianPhone('987654321')).toBe(false) // 9 digits
      expect(validateIndianPhone('98765432101')).toBe(false) // 11 digits
    })
  })

  // ─── GST Format ─────────────────────────────────────────────────────

  describe('Ethiopian VAT Format', () => {
    it('uses 15% VAT without split-state tax', () => {
      expect(gstConfig.cgstRate).toBe(15)
      expect(gstConfig.sgstRate).toBe(0)
    })

    it('calculateGST(1000) gives 150 VAT and 1150 total', () => {
      const result = calculateGST(1000)
      expect(result.cgstAmount).toBe(150)
      expect(result.sgstAmount).toBe(0)
      expect(result.totalTax).toBe(150)
      expect(result.grandTotal).toBe(1150)
    })

    it('VAT is 15% total', () => {
      expect(gstConfig.cgstRate + gstConfig.sgstRate).toBe(15)
      expect(gstConfig.igstRate).toBe(15)
    })
  })

  // ─── Aadhaar Validation ─────────────────────────────────────────────

  describe('Aadhaar Validation', () => {
    it('validateAadhar accepts 12-digit numbers', () => {
      expect(validateAadhar('123456789012')).toBe(true)
    })

    it('rejects shorter numbers', () => {
      expect(validateAadhar('12345678901')).toBe(false) // 11 digits
    })

    it('rejects longer numbers', () => {
      expect(validateAadhar('1234567890123')).toBe(false) // 13 digits
    })

    it('handles formatted input with spaces', () => {
      expect(validateAadhar('1234 5678 9012')).toBe(true)
    })

    it('handles formatted input with dashes', () => {
      expect(validateAadhar('1234-5678-9012')).toBe(true)
    })
  })

  // ─── Number to Words (Ethiopian Birr) ──────────────────────────────

  describe('Number to Words (Ethiopian Birr)', () => {
    it('numberToWords(1) returns "One Birr Only"', () => {
      expect(numberToWords(1)).toBe('One Birr Only')
    })

    it('numberToWords(100000) uses international grouping', () => {
      const result = numberToWords(100000)
      expect(result).toContain('Hundred Thousand')
      expect(result).not.toContain('Lakh')
    })

    it('numberToWords(10000000) contains "Million"', () => {
      const result = numberToWords(10000000)
      expect(result).toContain('Million')
    })

    it('numberToWords(1500.50) contains "Birr" and "Santim"', () => {
      const result = numberToWords(1500.5)
      expect(result).toContain('Birr')
      expect(result).toContain('Santim')
    })

    it('numberToWords(0) returns "Zero Birr Only"', () => {
      expect(numberToWords(0)).toBe('Zero Birr Only')
    })
  })

  // ─── GSTIN Validation ──────────────────────────────────────────────

  describe('GSTIN Validation', () => {
    it('accepts valid GSTIN (27AAPFU0939F1ZV)', () => {
      expect(validateGSTIN('27AAPFU0939F1ZV')).toBe(true)
    })

    it('accepts valid GSTIN from different states', () => {
      // State code 07 = Delhi
      expect(validateGSTIN('07AAPFU0939F1ZV')).toBe(true)
      // State code 33 = Tamil Nadu
      expect(validateGSTIN('33AAPFU0939F1ZV')).toBe(true)
    })

    it('rejects GSTIN shorter than 15 characters', () => {
      expect(validateGSTIN('27AAPFU0939F')).toBe(false)
    })

    it('rejects GSTIN longer than 15 characters', () => {
      expect(validateGSTIN('27AAPFU0939F1ZVXX')).toBe(false)
    })

    it('rejects GSTIN with invalid state code (00)', () => {
      expect(validateGSTIN('00AAPFU0939F1ZV')).toBe(false)
    })

    it('rejects GSTIN with state code > 37', () => {
      expect(validateGSTIN('99AAPFU0939F1ZV')).toBe(false)
    })

    it('rejects empty string', () => {
      expect(validateGSTIN('')).toBe(false)
    })

    it('rejects lowercase GSTIN', () => {
      expect(validateGSTIN('27aapfu0939f1zv')).toBe(false)
    })

    it('rejects GSTIN without Z in 13th position', () => {
      expect(validateGSTIN('27AAPFU0939F1AV')).toBe(false)
    })

    it('rejects GSTIN with special characters', () => {
      expect(validateGSTIN('27AAPFU0939F1Z!')).toBe(false)
    })
  })

  // ─── Time Format ────────────────────────────────────────────────────

  describe('Time Format', () => {
    it('billingFormatDateTime uses 12-hour AM/PM format', () => {
      // 14:30 (2:30 PM)
      const date = new Date(2026, 2, 8, 14, 30, 0)
      const result = billingFormatDateTime(date)
      // en-IN with hour12:true should produce am/pm or AM/PM
      expect(result).toMatch(/[apAP][mM]/)
    })

    it('billingFormatDateTime includes date components', () => {
      const date = new Date(2026, 2, 8, 10, 15, 0)
      const result = billingFormatDateTime(date)
      expect(result).toMatch(/08/)
      expect(result).toMatch(/Mar/)
      expect(result).toMatch(/2026/)
    })
  })
})
