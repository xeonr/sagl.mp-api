# SAGL: Server API
This repository contains the code for the SA:GL server API. The server API is a middleware which enables querying of the crawler data. A combination of MongoDB and Clickhouse are used for the various types of data served.

MongoDB is used as our primary storage. The latest data for each server tracked is imported into MongoDB and we use this for querying the servers list as well as retrieving details for any given server.

Snapshots of each server are imported into Clickhouse, maintaining a historical view of each server. This is used for aggregating player counts and latency for each server.

The server api *does no collection of data*. This is handled by [https://github.com/xeonr/sagl-crawler](the SA:GL crawler)
## Getting started
The API has 3 dependencies. `mysql`, `redis` and `aws s3`. 

Please ensure all are setup and configured in `config/development.json` (see `config/default.json` for an example config).


First, install the dependencies:
```bash
npm install
```

Then you can start the server:
```bash
npm start
```

When writing code, please lint your code before committing:
```bash
npm run lint
```
.
