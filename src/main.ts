/* eslint-disable @typescript-eslint/no-explicit-any */
import * as core from '@actions/core'
import { graphql } from '@octokit/graphql'
import { execSync } from 'child_process'
import { Octokit } from '@octokit/rest'
import * as fs from 'fs'

// Get config
const GH_USERNAME = core.getInput('GH_USERNAME')
const COMMIT_NAME = core.getInput('COMMIT_NAME')
const COMMIT_EMAIL = core.getInput('COMMIT_EMAIL')
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })

interface SponsoredProfile {
  sponsorLogin: string
  sponsorshipAmount: number
  currency: string
  createdAt: string
}

async function fetchSponsoredProfiles(): Promise<SponsoredProfile[]> {
  const query = `
      query {
          viewer {
              sponsorshipsAsSponsor(first: 100) {
                  nodes {
                      sponsorable {
                          ... on User {
                              login
                          }
                          ... on Organization {
                              login
                          }
                      }
                      tier {
                          monthlyPriceInDollars
                      }
                      createdAt
                  }
              }
          }
      }
  `

  try {
    const response = await graphql<any>({
      query,
      headers: {
        authorization: `token ${process.env.GITHUB_TOKEN}`
      }
    })

    core.debug(`Response: ${JSON.stringify(response)}`)

    const sponsoredProfiles: SponsoredProfile[] =
      response.viewer.sponsorshipsAsSponsor.nodes.map((sponsorship: any) => ({
        sponsorLogin: sponsorship.sponsorable.login,
        sponsorshipAmount: sponsorship.tier.monthlyPriceInDollars,
        currency: 'USD', // Assuming the currency is USD
        createdAt: sponsorship.createdAt
      }))

    return sponsoredProfiles
  } catch (error: any) {
    core.setFailed(`Error fetching sponsored profiles: ${error.message}`)
    return []
  }
}

async function commitIfNotDuplicate(
  commitMessage: string,
  fileUpdate?: { path: string; content: string }
): Promise<void> {
  const { data: commits } = await octokit.repos.listCommits({
    owner: GH_USERNAME,
    repo: GH_USERNAME,
    per_page: 100
  })

  const duplicateCommit = commits.find(
    (commit: any) => commit.commit.message === commitMessage
  )

  if (!duplicateCommit) {
    // Commit the changes
    execSync(`git config --global user.name "${COMMIT_NAME}"`)
    execSync(`git config --global user.email "${COMMIT_EMAIL}"`)
    execSync(`git commit --allow-empty -m "${commitMessage}"`)
    execSync('git push')
  } else {
    core.info(`Skipping duplicate commit: ${commitMessage}`)
  }
}

async function updateReadme(profiles: SponsoredProfile[]): Promise<void> {
  const allowReadmeUpdate = core.getInput('allow-add-to-readme') === 'true'
  if (!allowReadmeUpdate) return

  const readmePath = 'README.md'
  const startMarker = '<!-- SPONSORSHIP-DATA:START -->'
  const endMarker = '<!-- SPONSORSHIP-DATA:END -->'

  let readmeContent = ''
  try {
    readmeContent = fs.readFileSync(readmePath, 'utf8')
  } catch (error) {
    core.warning(`README.md not found, creating new file`)
  }

  const sponsorshipData = profiles
    .map(p => `- @${p.sponsorLogin}: ${p.sponsorshipAmount} ${p.currency}`)
    .join('\n')

  const newContent = `${startMarker}\n${sponsorshipData}\n${endMarker}`

  if (readmeContent) {
    const startIndex = readmeContent.indexOf(startMarker)
    const endIndex = readmeContent.indexOf(endMarker) + endMarker.length

    if (startIndex !== -1 && endIndex !== -1) {
      readmeContent =
        readmeContent.substring(0, startIndex) +
        newContent +
        readmeContent.substring(endIndex)
    } else {
      readmeContent = `${readmeContent}\n\n${newContent}`
    }
  } else {
    readmeContent = newContent
  }

  await commitIfNotDuplicate(
    `Update README with sponsorship data`,
    { path: readmePath, content: readmeContent }
  )
}

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */

export async function run(): Promise<void> {
  try {
    const ms: string = core.getInput('milliseconds')
    const profiles = await fetchSponsoredProfiles()
    await updateReadme(profiles)

    // Debug logs are only output if the `ACTIONS_STEP_DEBUG` secret is true
    core.debug(`Waiting ${ms} milliseconds ...`)

    // Log the current timestamp, wait, then log the new timestamp
    fetchSponsoredProfiles().then((data) => {
      core.debug(`number of profiles fetched: ${data.length}`)
      const currentDate = new Date()
      const month = currentDate.toLocaleString('default', { month: 'long' })
      const year = currentDate.getFullYear()

      data.forEach(async (profile) => {
        core.debug(`Sponsor: ${profile.sponsorLogin}`)
        const commitMessage = `${profile.sponsorshipAmount} ${profile.currency} paid to @${profile.sponsorLogin} for ${month} ${year} to support open source.`

        await commitIfNotDuplicate(commitMessage)
      })
    })
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
