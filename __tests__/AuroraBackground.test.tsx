import { render } from '@testing-library/react'
import BlobLayer from '@/components/BlobLayer'

describe('BlobLayer', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('renders 50 aurora-blob elements inside an aria-hidden wrapper', () => {
    const { container } = render(<BlobLayer />)
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
    expect(container.querySelectorAll('.aurora-blob')).toHaveLength(50)
  })

  test('each blob has inline width, height, background, and opacity', () => {
    const { container } = render(<BlobLayer />)
    const blobs = container.querySelectorAll('.aurora-blob')
    blobs.forEach(blob => {
      const el = blob as HTMLElement
      expect(el.style.width).toBeTruthy()
      expect(el.style.height).toBeTruthy()
      // jsdom's CSSOM rejects hsl(calc(var(...))) -- check raw attribute string instead
      expect(el.getAttribute('style')).toMatch(/background/)
      expect(el.style.opacity).toBeTruthy()
    })
  })
})
