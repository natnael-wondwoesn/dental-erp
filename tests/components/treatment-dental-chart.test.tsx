import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DentalChart } from '@/components/treatments/dental-chart'
import { toothNumbers } from '@/lib/treatment-utils'
import { parseExamTeeth } from '@/lib/dental-examination'

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ examinations: [] }),
  }) as unknown as typeof fetch
})
afterEach(() => vi.restoreAllMocks())

describe('treatment dental chart', () => {
  it('selects a tooth without submitting the parent treatment form', async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault())
    const onTeethSelect = vi.fn()

    render(
      <form onSubmit={onSubmit}>
        <DentalChart patientId="patient-1" selectedTeeth={[]} onTeethSelect={onTeethSelect} />
      </form>
    )

    fireEvent.click(screen.getByRole('button', { name: '11' }))

    expect(onTeethSelect).toHaveBeenCalledWith([11])
    expect(onSubmit).not.toHaveBeenCalled()
    expect(await screen.findByText(/Tooth 11 – Central Incisor/)).toBeTruthy()
  })

  it('lays the lower jaw out as 48-41 | 31-38', () => {
    expect(toothNumbers.lowerRight).toEqual([48, 47, 46, 45, 44, 43, 42, 41])
    expect(toothNumbers.lowerLeft).toEqual([31, 32, 33, 34, 35, 36, 37, 38])
  })

  it('shows selected teeth with condition, remove and clear all', async () => {
    const onTeethSelect = vi.fn()
    render(<DentalChart patientId="p1" selectedTeeth={[36, 11]} onTeethSelect={onTeethSelect} />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())

    expect(screen.getByText('36 – First Molar – Not examined')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Remove tooth 36'))
    expect(onTeethSelect).toHaveBeenCalledWith([11])
    fireEvent.click(screen.getByRole('button', { name: 'Clear All' }))
    expect(onTeethSelect).toHaveBeenCalledWith([])
  })

  it('reopens tooth details from the selected list', async () => {
    render(<DentalChart patientId="p1" selectedTeeth={[36]} onTeethSelect={vi.fn()} />)
    fireEvent.click(screen.getByText('36 – First Molar – Not examined'))
    expect(await screen.findByText('Tooth 36 – First Molar')).toBeTruthy()
    expect(screen.getByText('Treatment Required')).toBeTruthy()
  })
})

describe('parseExamTeeth', () => {
  it('keeps condition and planned treatment separate', () => {
    expect(
      parseExamTeeth({ '36': { condition: 'CARIES', treatmentRequired: 'FILLING', notes: 'x' } })
    ).toEqual({ '36': { condition: 'CARIES', treatmentRequired: 'FILLING', notes: 'x' } })
  })

  it('rejects invalid teeth, conditions and treatments', () => {
    expect(parseExamTeeth({ '99': { condition: 'CARIES' } })).toBeNull()
    expect(parseExamTeeth({ '36': { condition: 'BOGUS' } })).toBeNull()
    expect(parseExamTeeth({ '36': { condition: 'CARIES', treatmentRequired: 'X' } })).toBeNull()
  })
})
