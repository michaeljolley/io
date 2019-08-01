<p align="center">
    <img src="https://user-images.githubusercontent.com/1228996/61920397-11dc2d80-af1f-11e9-9695-7263d1e1d0f2.png"/>
</p>

| master | vNext | Contributors |
| --- | --- | --- |
| [![Build Status](https://dev.azure.com/michaeljolley/io-bot/_apis/build/status/Build%20IO?branchName=master)](https://dev.azure.com/michaeljolley/io-bot/_build/latest?definitionId=3&branchName=master) | [![Build Status](https://dev.azure.com/michaeljolley/io-bot/_apis/build/status/Build%20IO?branchName=vNext)](https://dev.azure.com/michaeljolley/io-bot/_build/latest?definitionId=3&branchName=vNext) |[![All Contributors](https://img.shields.io/badge/all_contributors-10-orange.svg?style=flat-square)](#contributors) |

IO is a Twitch chat-bot, overlay & stream note micro-service application.

## Services

All services use Node.js & TypeScript unless otherwise noted.

| Service        | Description                                                                                                             |
| ---            | ---                                                                                                                     |
| admin          | Web portal for administering entire system. (Under construction)                                                        |
| api            | Express API used as a proxy between third-party API's and the IO system                                                 |
| chat           | Connects to Twitch chat via IRC and emits various events to the io-hub service                                          |
| chron          | Executes various functions at timed intervals to update other services                                                  |
| hub            | A Socket.io hub that listens and emits events for the application                                                       |
| logger         | Listens to events emitted from the io-hub and logs to a MongoDB                                                         |
| overlay        | Web pages served by Express that listen to events from the io-hub and render UIs to be displayed on stream              |
| shared         | Contains interfaces, classes and data access logic used by other services                                               |
| streamnotes    | Listens for certain events emitted from the io-hub to generate stream notes for a completed stream and push to GitHub   |
| user           | Express web app that acts as a stateful service for all user (viewer) data used by the application                      |
| webhooks       | Express web app that listens for calls from third-parties and relays events to the io-hub                               |

## Environment Variables

When running locally, environment variables can be added to each service via a `.env` file in the services root directory.  An example
(`.env-example`) lives in the root of the repository.  Below is a description of all environment variables and their use.

| Variable                | Purpose                                                                                                     |
| ---                     | ---                                                                                                         |
| GITHUB_USER             | Username to authenticate with GitHub. All commits in streamnotes will be created with this user             |
| GITHUB_PASSWORD         | Password to authenticate with GitHub. All commits will need this.                                           |
| MONGO_DB_CONN_STRING    | Connection string for MongoDB that will store stream, user & vote data                                      |
| MONGO_DB_USER           | Username for MongoDB connection                                                                             |
| MONGO_DB_PASSWORD       | Password for MongoDB connection                                                                             |
| MONGO_DB_DATABASE       | Database that contains the stream, user & vote data                                                         |
| NGROK_AUTH_TOKEN        | Used by webhooks service when running the application locally.                                              |
| TWITCH_CLIENT_ID        | Client Id assigned to an application by Twitch at https://dev.twitch.tv                                     |
| TWITCH_CLIENT_TOKEN     | Auth token for the streamer's Twitch account                                                                |
| TWITCH_CLIENT_USERNAME  | Twitch login for the streamer                                                                               |
| TWITCH_CLIENT_USER_ID   | Twitch user id of the streamer                                                                              |
| TWITCH_BOT_USERNAME     | Twitch login for the bot.  Can be the same as TWITCH_CLIENT_USERNAME.                                       |
| TWITCH_BOT_TOKEN        | Twitch Auth token for the bot account.  Can be same as TWITCH_CLIENT_TOKEN                                  |

## Release Notes

See [CHANGELOG.md](CHANGELOG.md)

## Contributing

Want to contribute? Check out our [Code of Conduct](CODE_OF_CONDUCT.md) and [Contributing](CONTRIBUTING.md) docs. This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification.  Contributions of any kind welcome!

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore -->
<table>
  <tr>
    <td align="center"><a href="https://github.com/parithon"><img src="https://avatars3.githubusercontent.com/u/8602418?v=4" width="100px;" alt="Anthony Conrad"/><br /><sub><b>Anthony Conrad</b></sub></a><br /><a href="#ideas-parithon" title="Ideas, Planning, & Feedback">🤔</a> <a href="https://github.com/MichaelJolley/io/commits?author=parithon" title="Code">💻</a> <a href="#infra-parithon" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a></td>
    <td align="center"><a href="https://github.com/sushinateur"><img src="https://avatars3.githubusercontent.com/u/36899634?v=4" width="100px;" alt="Sushinateur"/><br /><sub><b>Sushinateur</b></sub></a><br /><a href="#ideas-sushinateur" title="Ideas, Planning, & Feedback">🤔</a></td>
    <td align="center"><a href="http://www.codephobia.com"><img src="https://avatars1.githubusercontent.com/u/6385224?v=4" width="100px;" alt="Martin Raymond"/><br /><sub><b>Martin Raymond</b></sub></a><br /><a href="#ideas-codephobia" title="Ideas, Planning, & Feedback">🤔</a> <a href="https://github.com/MichaelJolley/io/commits?author=codephobia" title="Code">💻</a> <a href="#infra-codephobia" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a></td>
    <td align="center"><a href="https://drp3.me/"><img src="https://avatars0.githubusercontent.com/u/119065?v=4" width="100px;" alt="David Poindexter"/><br /><sub><b>David Poindexter</b></sub></a><br /><a href="#infra-mtheoryx" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="#ideas-mtheoryx" title="Ideas, Planning, & Feedback">🤔</a></td>
    <td align="center"><a href="https://michaeljolley.com/"><img src="https://avatars2.githubusercontent.com/u/1228996?v=4" width="100px;" alt="Michael Jolley"/><br /><sub><b>Michael Jolley</b></sub></a><br /><a href="#ideas-MichaelJolley" title="Ideas, Planning, & Feedback">🤔</a> <a href="https://github.com/MichaelJolley/io/commits?author=MichaelJolley" title="Code">💻</a> <a href="#infra-MichaelJolley" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="https://github.com/MichaelJolley/io/commits?author=MichaelJolley" title="Documentation">📖</a></td>
    <td align="center"><a href="https://github.com/andresamaris"><img src="https://avatars0.githubusercontent.com/u/19216518?v=4" width="100px;" alt="Andrés Amarís"/><br /><sub><b>Andrés Amarís</b></sub></a><br /><a href="https://github.com/MichaelJolley/io/commits?author=andresamaris" title="Code">💻</a></td>
    <td align="center"><a href="https://c-j.tech"><img src="https://avatars0.githubusercontent.com/u/3969086?v=4" width="100px;" alt="Chris Jones"/><br /><sub><b>Chris Jones</b></sub></a><br /><a href="#ideas-cmjchrisjones" title="Ideas, Planning, & Feedback">🤔</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/Flyken271"><img src="https://avatars0.githubusercontent.com/u/39961800?v=4" width="100px;" alt="Flyken"/><br /><sub><b>Flyken</b></sub></a><br /><a href="#ideas-Flyken271" title="Ideas, Planning, & Feedback">🤔</a></td>
    <td align="center"><a href="https://github.com/copperbeardy"><img src="https://avatars3.githubusercontent.com/u/4822063?v=4" width="100px;" alt="Davin Davies"/><br /><sub><b>Davin Davies</b></sub></a><br /><a href="#ideas-copperbeardy" title="Ideas, Planning, & Feedback">🤔</a></td>
    <td align="center"><a href="https://github.com/CodemanCodes"><img src="https://avatars3.githubusercontent.com/u/46641880?v=4" width="100px;" alt="CodemanCodes"/><br /><sub><b>CodemanCodes</b></sub></a><br /><a href="#ideas-CodemanCodes" title="Ideas, Planning, & Feedback">🤔</a> <a href="#userTesting-CodemanCodes" title="User Testing">📓</a></td>
  </tr>
</table>

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!
