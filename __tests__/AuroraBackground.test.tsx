import { render } from '@testing-library/react'
import Home from '@/app/page'

describe('Aurora Background', () => {
  beforeEach(() => {
    jest.spyOn(window, 'requestAnimationFrame').mockReturnValue(0 as unknown as ReturnType<typeof requestAnimationFrame>);
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('renders all 5 aurora blob elements', () => {
    const { container } = render(<Home />)
    expect(container.querySelector('.aurora-blob-1')).toBeInTheDocument()
    expect(container.querySelector('.aurora-blob-2')).toBeInTheDocument()
    expect(container.querySelector('.aurora-blob-3')).toBeInTheDocument()
    expect(container.querySelector('.aurora-blob-4')).toBeInTheDocument()
    expect(container.querySelector('.aurora-blob-5')).toBeInTheDocument()
  })
})
