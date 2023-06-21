# odp-datastack-migration

## Setup
 - Download Docker Image from Docker Hub:- [`appveen/odp-datastack-migration:1.0.1`](https://hub.docker.com/r/appveen/odp-datastack-migration)
 - Download the [`migration.yaml`](https://github.com/appveen/ds-migrations/blob/dev/migration.yaml) file.
 - Edit the yaml file and update `__namespace__` value to the existing ODP namespace
 - Apply the `migration.yaml` file to create migration pod.
 - Use the below curl commands to trigger migration
 - Check pod logs for successfull migration
## Migrate Security Keys
```sh
curl -X "POST" "http://<ClusterIP of Pod>:3000/api/migrate/securityKeys" \
     -H 'Content-Type: application/json' \
     -d $'{}'
```
## Migrate Data Services
```sh
curl -X "POST" "http://<ClusterIP of Pod>:3000/api/migrate/dataService" \
     -H 'Content-Type: application/json' \
     -d $'{}'
```

## Migrate Libraries
```sh
curl -X "POST" "http://<ClusterIP of Pod>:3000/api/migrate/libraries" \
     -H 'Content-Type: application/json' \
     -d $'{}'
```