# SAGL: Server API
This repository contains the code for the SA:GL Server API. The server API is a middleware which enables querying of the crawler data. A combination of MongoDB and Clickhouse are used for serving the server data we collect. All APIs are exposed using GRPC (via buf's connect) and use the buf.build registry. You can find the published protocol here: https://buf.build/xeonr/sagl-servers 

MongoDB is used as our primary storage. The latest data for each server tracked is imported into MongoDB and we use this for querying the servers list as well as retrieving details for any given server.

Snapshots of each server are imported into Clickhouse, maintaining a historical view of each server. This is used for aggregating player counts and latency for each server.

The server api *does no collection of data*. This is handled by [https://github.com/xeonr/sagl.mp-crawler](the SA:GL crawler). The crawler collects data on average every ~10 minutes and is imported on a delay of up to 60 minutes depending on the processing times.

The server API additionally contains any administrative logic, using tokens signed by [https://github.com/xeonr/sagl-cloud-api](the SA:GL cloud API). 

## Getting started
The API has 3 dependencies. `mongodb`, `clickhouse` and `aws s3`. 

First, install the dependencies:
```bash
npm install
```

Then you can start the server:
```bash
npm start
```

## Environment
| Variable                | Description                                                  | Required | Example                                    | Default |
|-------------------------|--------------------------------------------------------------|----------|--------------------------------------------|---------|
| `CLICKHOUSE_HOST`           | MongoDB connection string, used for fetching                 | Yes      | `http://clickhouse.local`                |         |
| `CLICKHOUSE_USERNAME`            | MongoDB database to interact with                            | Yes      | `sagl-dev`                                |         |
| `CLICKHOUSE_PASSWORD`     | Number of concurrent queries to run                          | No       | `password`                                       | `10`    |
| `CLICKHOUSE_DATABASE`         | The S3 bucket for storing crawls and metadata                | Yes      | `sagl-crawls-dev`                         |         |
| `S3_SERVER_BUCKET`         | The S3 bucket for storing crawls and metadata                | Yes      | `sagl-uploads`                         |         |
| `AWS_ACCESS_KEY_ID`     | The S3 bucket for storing crawls and metadata                | Yes      | `AKIARNEAEEEEEEEEEEEE`                     |         |
| `AWS_SECRET_ACCESS_KEY` | The S3 bucket for storing crawls and metadata                | Yes      | `xc9Q9xxxxxxeoAMY+xxxxxxbb3sjV/xxxxxxxxxx` |         |
| `AWS_REGION`            | The S3 bucket for storing crawls and metadata                | Yes      | `us-east-2`                                |         |
| `MONGODB_URI`         | The directory where the MaxMind Geo IP databases are located | Yes      | `mongodb://sagl_crawler:sekrit@mongodb.local:27017/sagl_dev`                                 |         |
| `JWT_TOKEN`         | The directory where the MaxMind Geo IP databases are located | Yes      | `test-token`                                 |         |

## Production deployments
This application is deployed to a multi-node Kubernetes cluster, fronted by Traefik. You can find the configuration for this in infra/production.yml. Any secrets are injected at runtime via Hashicorp vault.
