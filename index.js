require('dotenv').config()

// @ts-check
const app = require('./src/app')

app.listen(8080, () => console.log('Listening on port 8080'))
