#!/bin/bash

docker stop migrations
docker rm migrations

docker build -t migrations:1.0.0 .

docker run -itd --restart always -p 3000:3000 --name migrations migrations:1.0.0