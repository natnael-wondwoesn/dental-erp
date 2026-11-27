import { describe, expect, it } from 'vitest'

import { medicalHistoryFromConditions } from '@/lib/braces/medical'
import { assessmentData, bracesAssessmentSchema } from '@/lib/braces/schema'

describe('medical conditions from an assessment', () => {
  it('switches the matching flags on and never clears anything', () => {
    expect(
      medicalHistoryFromConditions(['DIABETES_2', 'HYPERTENSION', 'ASTHMA', 'LIVER'], '', null)
    ).toEqual({
      hasDiabetes: true,
      diabetesType: 'Type 2',
      hasHypertension: true,
      hasAsthma: true,
      hasHepatitis: true,
    })
    expect(medicalHistoryFromConditions(['DIABETES_1', 'DIABETES_2'], '', null).diabetesType).toBe(
      'Type 1 & 2'
    )
  })

  it('does nothing for "None" or an empty selection', () => {
    expect(medicalHistoryFromConditions(['NONE'], '', null)).toEqual({})
    expect(medicalHistoryFromConditions([], '', { otherConditions: 'Thyroid' })).toEqual({})
  })

  it('appends kidney and other conditions without duplicating earlier notes', () => {
    const first = medicalHistoryFromConditions(['KIDNEY', 'OTHER'], 'Penicillin allergy', {
      otherConditions: 'Thyroid',
    })
    expect(first.otherConditions).toBe('Thyroid\nKidney problems\nPenicillin allergy')
    const again = medicalHistoryFromConditions(['KIDNEY'], '', {
      otherConditions: first.otherConditions as string,
    })
    expect(again).toEqual({})
  })
})

describe('assessment schema', () => {
  const base = { assessedAt: '2026-11-26' }

  it('stores sex, conditions and the other-condition text', () => {
    const input = bracesAssessmentSchema.parse({
      ...base,
      sex: 'FEMALE',
      medicalConditions: ['HEART', 'OTHER'],
      medicalOther: 'Latex allergy',
    })
    const data = assessmentData(input)
    expect(data.sex).toBe('FEMALE')
    expect(data.medicalConditions).toEqual(['HEART', 'OTHER'])
    expect(data.medicalOther).toBe('Latex allergy')
  })

  it('drops the other-condition text when "Other" is not ticked', () => {
    const data = assessmentData(
      bracesAssessmentSchema.parse({ ...base, medicalConditions: ['HEART'], medicalOther: 'stale' })
    )
    expect(data.medicalOther).toBeNull()
  })

  it('does not allow "None" together with a condition, or an unknown condition', () => {
    expect(
      bracesAssessmentSchema.safeParse({ ...base, medicalConditions: ['NONE', 'HIV'] }).success
    ).toBe(false)
    expect(bracesAssessmentSchema.safeParse({ ...base, medicalConditions: ['GOUT'] }).success).toBe(
      false
    )
    expect(bracesAssessmentSchema.safeParse({ ...base, sex: 'ROBOT' }).success).toBe(false)
  })

  it('does not store an empty chart', () => {
    const empty = assessmentData(bracesAssessmentSchema.parse({ ...base, palmerChart: {} }))
    expect(empty.palmerChart).toBeUndefined()
    const drawn = assessmentData(
      bracesAssessmentSchema.parse({
        ...base,
        palmerChart: { texts: [{ id: 't', x: 5, y: 5, text: 'UR6 caries' }] },
      })
    )
    expect(drawn.palmerChart?.texts).toHaveLength(1)
  })
})

describe('blank numbers', () => {
  it('stores an empty measurement as not measured, not as 0', () => {
    const data = assessmentData(
      bracesAssessmentSchema.parse({ assessedAt: '2026-11-26', overjetMm: '', overbiteMm: '3.5' })
    )
    expect(data.overjetMm).toBeNull()
    expect(data.overbiteMm).toBe(3.5)
    expect(
      assessmentData(bracesAssessmentSchema.parse({ assessedAt: '2026-11-26', overjetMm: '0' }))
        .overjetMm
    ).toBe(0)
  })
})
