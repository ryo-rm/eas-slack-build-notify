## eas-slack-build-notify
A serverless lambda to notify the result of EAS build.  
Using [Serverless Framework](https://www.serverless.com/).

## Installation

1. Slack Bot Setup
    1. [Create slack app](https://slack.dev/bolt-js/tutorial/getting-started)  
    needs a [`chat:write`](https://api.slack.com/scopes/chat:write) and [`files:write`](https://api.slack.com/scopes/files:write)  
       <img alt="slack scopes" src="./.gh-assets/slack-oauth-scopes.png">
    1. Invite app to channel
    1. Rewrite `REPLACE_ME` in the [serverless.yml](./serverless.yml) file
    1. Deploy to AWS  
        ```sh
        $ npm i
        $ sls deploy
        ```
1. EAS Build Webhooks setup
    1. Set up a webhook with [`eas webhook:create`](https://docs.expo.dev/build-reference/build-webhook/).   
        The URL of the webhook is the URL of the endpoint returned by `sls deploy`.  
        e.g. `https://XXXXXXXX.execute-api.YOUR-REGION.amazonaws.com/dev/webhook`

## Environment

| NAME | Required | Description | Example/Document |
| - | - | - | - |
| EAS_SECRET_WEBHOOK_KEY | true | EAS  | [see `SECRET_WEBHOOK_KEY`](https://docs.expo.dev/build-reference/build-webhook/) |
| SLACK_TOKEN | true | The OAuth token. | xoxb-XXXXXXX |
| SLACK_CHANNEL | true | Slack channel |  |
| SLACK_CLIENT_ID | false | Client id |  |
| SLACK_SIGNING_SECRET | false | signing secret |  |
| SLACK_CLIENT_SECRET | false |  |  |
| EXPO_SLACK_ACCOUNT | false | Used for mentioning in Slack.  Format: `expo_account1:slack_account1,expo_account2:slack_account2` | `ryo-rm:U01MG0XXXXX` |