# odp-datastack-migration

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