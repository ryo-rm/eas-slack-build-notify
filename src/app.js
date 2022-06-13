// @ts-check
const crypto = require('crypto')
const express = require('express')
const bodyParser = require('body-parser')
const safeCompare = require('safe-compare')
const { PassThrough } = require('stream')
const { App } = require('@slack/bolt')
const QRCode = require('qrcode')

const app = express()
app.use(bodyParser.text({ type: '*/*' }))

const bolt = new App({
  clientId: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  token: process.env.SLACK_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
})

// type: 'build' | 'submit'
app.post('/eas/:type', async (req, res) => {
  const expoSignature = req.headers['expo-signature']
  const hmac = crypto.createHmac('sha1', process.env.EAS_WEBHOOK_SECRET)
  hmac.update(req.body)
  const hash = `sha1=${hmac.digest('hex')}`
  // @ts-ignore
  if (!safeCompare(expoSignature, hash)) {
    res.status(500).send("Signatures didn't match!")
  }

  const { type } = req.params

  if (type === 'submit') {
    const { platform, status, submissionInfo } = JSON.parse(req.body)
    let message
    let messageConfig = {}
    switch (status) {
      case 'finished':
        message = 'Successfully uploaded iOS build to App Store Connect.'
        messageConfig = {
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: message,
              },
            },
          ],
        }
        break
      case 'errored':
        const { error } = submissionInfo
        message = 'App Store Connect iOS build upload failed.'
        messageConfig = {
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: message,
              },
            },
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: `*Platform*\n${platform}`,
                },
              ],
            },
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: `*Error Code*\n${error?.errorCode}`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Error Message*\n${error?.message}`,
                },
              ],
            },
          ],
        }
        break
      case 'canceled':
        message = 'App Store Connect iOS build upload was cancelled.'
        messageConfig = {
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: message,
              },
            },
          ],
        }
        break
    }

    await bolt.client.chat.postMessage({
      ...messageConfig,
      channel: process.env.EAS_SUBMIT_CHANNEL,
    })
  } else if (type === 'build') {
    const { id, appId, status, artifacts, metadata, platform, error } = JSON.parse(req.body)

    const buildUrl = `https://expo.dev/accounts/teatalk-technologies/projects/radioface/builds/${id}`
    const buildSummary = `App: ${metadata.appName}\nProfile: ${metadata.buildProfile}\nVersion: ${metadata.appVersion}\nBuild Number: ${metadata.appBuildVersion}\nUser: ${metadata.username}\n${buildUrl}`
    switch (status) {
      case 'finished': {
        const qrStream = new PassThrough()
        switch (platform) {
          case 'ios':
            await QRCode.toFileStream(
              qrStream,
              `itms-services://?action=download-manifest;url=https://exp.host/--/api/v2/projects/${appId}/builds/${id}/manifest.plist`,
              {
                type: 'png',
                width: 200,
                errorCorrectionLevel: 'H',
              }
            )
            break
          default:
            await QRCode.toFileStream(qrStream, artifacts?.buildUrl, {
              type: 'png',
              width: 200,
              errorCorrectionLevel: 'H',
            })
            break
        }

        await bolt.client.files.upload({
          channels: process.env.EAS_BUILD_CHANNEL,
          initial_comment: `*Build Success*\n${buildSummary}`,
          file: qrStream,
          title: `Download ${metadata.appName}`,
        })
        break
      }
      case 'errored': {
        await bolt.client.chat.postMessage({
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Build Failure*\n${buildSummary}`,
              },
            },
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: `*Error Code*\n${error?.errorCode}`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Error Message*\n${error?.message}`,
                },
              ],
            },
          ],
          channel: process.env.EAS_BUILD_CHANNEL,
        })
        break
      }
      default:
        console.warn(req.body)
        break
    }
    res.send('OK!')
  }
})

module.exports = app
