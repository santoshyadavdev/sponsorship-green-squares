import { jest, describe, it, expect, beforeEach } from '@jest/globals'

const mockGetInput = jest.fn()
const mockSetFailed = jest.fn()
const mockSetOutput = jest.fn()
const mockDebug = jest.fn()
const mockInfo = jest.fn()
const mockWarning = jest.fn()
const mockError = jest.fn()

const mockListCommits = jest.fn<() => Promise<{data: any[]}>>()
const mockRequest = jest.fn<() => Promise<{data: any}>>()
const mockOctokit = jest.fn().mockImplementation(() => ({
  repos: {
    listCommits: mockListCommits
  },
  request: mockRequest
}))

const mockGraphql = jest.fn<() => Promise<any>>()
const mockExecSync = jest.fn()
const mockWriteFileSync = jest.fn()
const mockExistsSync = jest.fn()
const mockReadFileSync = jest.fn()

jest.unstable_mockModule('@actions/core', () => ({
  getInput: mockGetInput,
  setFailed: mockSetFailed,
  setOutput: mockSetOutput,
  debug: mockDebug,
  info: mockInfo,
  warning: mockWarning,
  error: mockError
}))

jest.unstable_mockModule('@octokit/rest', () => ({
  Octokit: mockOctokit
}))

jest.unstable_mockModule('@octokit/graphql', () => ({
  graphql: mockGraphql
}))

jest.unstable_mockModule('child_process', () => ({
  execSync: mockExecSync
}))

jest.unstable_mockModule('fs', () => ({
  default: {
    writeFileSync: mockWriteFileSync,
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync
  },
  writeFileSync: mockWriteFileSync,
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync
}))

const { run } = await import('../src/main')

describe('run', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockExistsSync.mockReturnValue(false) // README doesn't exist by default
    mockRequest.mockResolvedValue({ data: { name: 'github-actions[bot]', email: 'github-actions[bot]@users.noreply.github.com' } })
  })

  it('Commits changes if not duplicate', async () => {
    mockGetInput.mockReturnValueOnce('1000')
    
    // Mock graphql response with sponsored profiles
    mockGraphql.mockResolvedValue({
      viewer: {
        sponsorshipsAsSponsor: {
          nodes: [
            {
              sponsorable: { login: 'test-sponsor' },
              tier: { monthlyPriceInDollars: 5 },
              createdAt: '2024-01-01T00:00:00Z'
            }
          ]
        }
      }
    } as any)
    
    // Mock Octokit to return no duplicate commits
    mockListCommits.mockResolvedValue({ data: [] })
    
    mockWriteFileSync.mockImplementation(() => {})
    mockExecSync.mockReturnValue('')

    await run()

    expect(mockExecSync).toHaveBeenCalledWith(
      'git config --global user.name "github-actions[bot]"'
    )
    expect(mockExecSync).toHaveBeenCalledWith(
      'git config --global user.email "github-actions[bot]@users.noreply.github.com"'
    )
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining('git commit --allow-empty -m')
    )
    expect(mockExecSync).toHaveBeenCalledWith('git push')
  })

  it('Skips duplicate commit', async () => {
    mockGetInput.mockReturnValueOnce('1000')
    
    // Mock graphql response with sponsored profiles
    mockGraphql.mockResolvedValue({
      viewer: {
        sponsorshipsAsSponsor: {
          nodes: [
            {
              sponsorable: { login: 'test-sponsor' },
              tier: { monthlyPriceInDollars: 5 },
              createdAt: '2024-01-01T00:00:00Z'
            }
          ]
        }
      }
    } as any)
    
    // Mock Octokit to return a duplicate commit
    mockListCommits.mockResolvedValue({
      data: [{ commit: { message: '5 USD paid to @test-sponsor for January 2026 to support open source.' } }]
    })

    await run()

    // Should not push when duplicate is found
    expect(mockExecSync).not.toHaveBeenCalledWith('git push')
    // Should log that it's skipping the duplicate
    expect(mockInfo).toHaveBeenCalledWith(
      expect.stringContaining('Skipping duplicate commit')
    )
  })
})
