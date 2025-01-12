/* eslint-disable @typescript-eslint/no-explicit-any */
import * as core from '@actions/core'
import { graphql } from '@octokit/graphql'
import { execSync } from 'child_process'
import { Octokit } from '@octokit/rest'

// Get config
const GH_USERNAME = core.getInput('GH_USERNAME')
const COMMIT_NAME = core.getInput('COMMIT_NAME')
const COMMIT_EMAIL = core.getInput('COMMIT_EMAIL')
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })

/**
 * A sponsored profile.
 */
interface SponsoredProfile {
  sponsorLogin: string
  sponsorshipAmount: number
  currency: string
  createdAt: string
}

/**
 * Fetches sponsored profiles from the GitHub API.
 *
 * @returns A list of sponsored profiles.
 */
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

/**
 * Commits the changes if the commit message is not a duplicate.
 *
 * @param commitMessage The commit message.
 */
async function commitIfNotDuplicate(commitMessage: string) {
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
    core.setFailed(`Duplicate commit found: ${commitMessage}`)
  }
}

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const ms: string = core.getInput('milliseconds')

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
