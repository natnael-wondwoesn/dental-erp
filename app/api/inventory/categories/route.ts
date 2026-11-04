import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import prisma from '@/lib/prisma'

// GET - Fetch all categories
export async function GET(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // New clinics start with no categories, which leaves the dropdown empty.
    if ((await prisma.inventoryCategory.count({ where: { hospitalId } })) === 0) {
      await prisma.inventoryCategory.createMany({
        data: [
          'Dental Materials',
          'Anesthetics',
          'Consumables',
          'Instruments',
          'Sterilization',
          'Orthodontic Supplies',
          'Endodontic Supplies',
          'Surgical Supplies',
          'Office Supplies',
          'Medications',
        ].map((name) => ({ hospitalId, name })),
      })
    }
    const categories = await prisma.inventoryCategory.findMany({
      where: { hospitalId },
      include: {
        _count: {
          select: {
            items: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    // Transform the response to match expected format
    const categoriesWithCount = categories.map((category) => ({
      ...category,
      item_count: category._count.items,
    }))

    return NextResponse.json({
      success: true,
      data: categoriesWithCount,
    })
  } catch (error: any) {
    console.error('Error fetching categories:', error)
    return NextResponse.json(
      { error: 'Failed to fetch categories', details: error.message },
      { status: 500 }
    )
  }
}

// POST - Let the clinic add its own category
export async function POST(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await request.json()
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 100) : ''
    if (!name) return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
    const existing = await prisma.inventoryCategory.findFirst({
      where: { hospitalId, name },
    })
    const category =
      existing ?? (await prisma.inventoryCategory.create({ data: { hospitalId, name } }))
    return NextResponse.json({ success: true, data: category }, { status: existing ? 200 : 201 })
  } catch (err) {
    console.error('Error creating category:', err)
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}
