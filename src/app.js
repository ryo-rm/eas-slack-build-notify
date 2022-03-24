// @ts-check
const crypto = require("crypto");
const express = require("express");
const bodyParser = require("body-parser");
const safeCompare = require("safe-compare");
const { PassThrough } = require("stream");
const { App } = require("@slack/bolt");
const QRCode = require("qrcode");

const app = express();
app.use(bodyParser.text({ type: "*/*" }));

const bolt = new App({
  clientId: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  token: process.env.SLACK_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

app.post("/webhook", async (req, res) => {
  console.log(JSON.stringify(req.body));
  const expoSignature = req.headers["expo-signature"];
  // process.env.EAS_SECRET_WEBHOOK_KEY has to match SECRET value set with `eas webhook:create` command
  const hmac = crypto.createHmac("sha1", process.env.EAS_SECRET_WEBHOOK_KEY);
  hmac.update(req.body);
  const hash = `sha1=${hmac.digest("hex")}`;
  // @ts-ignore
  if (!safeCompare(expoSignature, hash)) {
    res.status(500).send("Signatures didn't match!");
  } else {
    const { id, appId, status, artifacts, metadata, platform, error } =
      JSON.parse(req.body);
    let username = metadata?.username;
    if (process.env.EXPO_SLACK_ACCOUNT) {
      for (const account of process.env.EXPO_SLACK_ACCOUNT.split(",")) {
        const [expo, slack] = account.split(":");
        if (expo === username) {
          username = `<@${slack}>`;
          break;
        }
      }
    }
    const buildUrl = `https://expo.io/accounts/${
      metadata?.trackingContext?.account_name ||
      process.env.EXPO_DEFAULT_TEAM_NAME
    }/projects/${metadata?.appName}/builds/${id}`;
    switch (status) {
      case "finished": {
        const qrStream = new PassThrough();
        switch (platform) {
          case "ios":
            await QRCode.toFileStream(
              qrStream,
              `itms-services://?action=download-manifest;url=https://exp.host/--/api/v2/projects/${appId}/builds/${id}/manifest.plist`,
              {
                type: "png",
                width: 200,
                errorCorrectionLevel: "H",
              }
            );
            break;
          default:
            await QRCode.toFileStream(qrStream, artifacts?.buildUrl, {
              type: "png",
              width: 200,
              errorCorrectionLevel: "H",
            });
            break;
        }

        await bolt.client.files.upload({
          channels: process.env.SLACK_CHANNEL,
          initial_comment: `:sunny: Build Success.\nPlatform: ${platform}\nUser: ${username}\n${buildUrl}`,
          file: qrStream,
          title: "expo",
        });
        break;
      }
      case "errored": {
        await bolt.client.chat.postMessage({
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: ":rain_cloud: Build Failure.",
              },
            },
            {
              type: "section",
              fields: [
                {
                  type: "mrkdwn",
                  text: `*Platform*\n${platform}`,
                },
                {
                  type: "mrkdwn",
                  text: `*User*\n${username}`,
                },
              ],
            },
            {
              type: "section",
              fields: [
                {
                  type: "mrkdwn",
                  text: `*Error Code*\n${error?.errorCode}`,
                },
                {
                  type: "mrkdwn",
                  text: `*Error Message*\n${error?.message}`,
                },
              ],
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Detail*\n${buildUrl}`,
              },
            },
          ],
          channel: process.env.SLACK_CHANNEL,
        });
        break;
      }
      default:
        console.warn(req.body);
        break;
    }
    res.send("OK!");
  }
});

module.exports = app;
