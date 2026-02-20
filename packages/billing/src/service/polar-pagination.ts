type PolarListPage<TItem> = {
  result: {
    items: TItem[]
  }
}

type PaginatedPolarFetch<TItem> = (
  page: number,
  limit: number
) => Promise<PolarListPage<TItem>>

type PolarPaginationOptions = {
  maxItems?: number
  pageSize?: number
}

const DEFAULT_POLAR_PAGE_SIZE = 100
const MAX_POLAR_PAGE_SIZE = 100
export const MAX_POLAR_SCAN_ITEMS = 1000

function clampPageSize(pageSize?: number): number {
  if (!pageSize || pageSize <= 0) {
    return DEFAULT_POLAR_PAGE_SIZE
  }

  return Math.min(pageSize, MAX_POLAR_PAGE_SIZE)
}

function clampMaxItems(maxItems?: number): number {
  if (!maxItems || maxItems <= 0) {
    return MAX_POLAR_SCAN_ITEMS
  }

  return Math.min(maxItems, MAX_POLAR_SCAN_ITEMS)
}

export async function collectPaginatedPolarItems<TItem>(input: {
  fetchPage: PaginatedPolarFetch<TItem>
  options?: PolarPaginationOptions
}): Promise<TItem[]> {
  const pageSize = clampPageSize(input.options?.pageSize)
  const maxItems = clampMaxItems(input.options?.maxItems)

  const items: TItem[] = []
  let page = 1

  while (items.length < maxItems) {
    const pageResult = await input.fetchPage(page, pageSize)
    const pageItems = pageResult.result.items

    if (pageItems.length === 0) {
      break
    }

    const remaining = maxItems - items.length
    items.push(...pageItems.slice(0, remaining))

    if (pageItems.length < pageSize) {
      break
    }

    page += 1
  }

  return items
}

export async function findPaginatedPolarItems<TItem>(input: {
  fetchPage: PaginatedPolarFetch<TItem>
  matches: (item: TItem) => boolean
  options?: PolarPaginationOptions
}): Promise<{ exactMatch: TItem | null; firstItem: TItem | null }> {
  const pageSize = clampPageSize(input.options?.pageSize)
  const maxItems = clampMaxItems(input.options?.maxItems)

  let scanned = 0
  let firstItem: TItem | null = null
  let page = 1

  while (scanned < maxItems) {
    const pageResult = await input.fetchPage(page, pageSize)
    const pageItems = pageResult.result.items

    if (pageItems.length === 0) {
      break
    }

    for (const item of pageItems) {
      scanned += 1
      if (!firstItem) {
        firstItem = item
      }

      if (input.matches(item)) {
        return { exactMatch: item, firstItem }
      }

      if (scanned >= maxItems) {
        return { exactMatch: null, firstItem }
      }
    }

    if (pageItems.length < pageSize) {
      break
    }

    page += 1
  }

  return { exactMatch: null, firstItem }
}
