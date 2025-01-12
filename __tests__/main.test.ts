import { run } from '../src/main'
import * as core from '@actions/core'
import { Octokit } from '@octokit/rest'
import { execSync } from 'child_process'
import fs from 'fs'

jest.mock('@actions/core')
jest.mock('@octokit/rest')
jest.mock('child_process')
jest.mock('fs')

describe('run', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('Commits changes if not duplicate', async () => {
    core.getInput.mockReturnValueOnce('1000')
    const mockListCommits = jest.fn().mockResolvedValue({ data: [] })
    Octokit.mockImplementation(() => ({
      repos: {
        listCommits: mockListCommits
      }
    }))
    fs.writeFileSync.mockImplementation(() => {})
    execSync.mockImplementation(() => {})

    await run()

    expect(execSync).toHaveBeenCalledWith(
      'git config --global user.name "github-actions[bot]"'
    )
    expect(execSync).toHaveBeenCalledWith(
      'git config --global user.email "github-actions[bot]@users.noreply.github.com"'
    )
    expect(execSync).toHaveBeenCalledWith(expect.stringContaining('git add'))
    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining('git commit -m')
    )
    expect(execSync).toHaveBeenCalledWith('git push')
  })

  it('Fails on duplicate commit', async () => {
    core.getInput.mockReturnValueOnce('1000')
    const mockListCommits = jest.fn().mockResolvedValue({
      data: [{ commit: { message: 'duplicate commit message' } }]
    })
    Octokit.mockImplementation(() => ({
      repos: {
        listCommits: mockListCommits
      }
    }))

    await run()

    expect(core.setFailed).toHaveBeenNthCalledWith(
      1,
      'Duplicate commit found: duplicate commit message'
    )
  })
})
