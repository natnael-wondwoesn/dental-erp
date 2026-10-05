import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DentalChart } from '@/components/treatments/dental-chart'

describe('treatment dental chart', () => {
  it('selects a tooth without submitting the parent treatment form', () => {
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
  })
})
