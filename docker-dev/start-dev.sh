#!/bin/bash

docker build ../ -f ../docker/Dockerfile -t proxy-dev

echo "Creating a temporary runtime folder..."

mkdir target

echo "Creating TMForum configuration from templates..."

mustache tmforum.yaml docker-compose-tmforum.mustache > target/docker-compose-tmf.yml
mustache tmforum.yaml proxy-env.mustache > target/proxy-env.env

echo "Preparing compose files..."

cp docker-compose-env.yml target/docker-compose-env.yml
cp docker-compose.yml target/docker-compose.yml

docker volume create postgres
docker volume create proxy-data

echo "Starting..."

cd target
docker compose -f docker-compose-tmf.yml -f docker-compose-env.yml -f docker-compose.yml up -d 
# start the logs in a subshell and disconnect from the stdout
(docker compose -f docker-compose-tmf.yml -f docker-compose-env.yml -f docker-compose.yml logs --no-color -f >& ../compose.log) > /dev/null &
cd ..

echo "Follow the logs in compose.log, f.e. \"tail -f compose.log\""
echo "Enter to stop and clean up."

read -n 1 -s 

docker compose -f target/docker-compose-tmf.yml -f target/docker-compose-env.yml -f target/docker-compose.yml down

chmod -R +rw target 
rm -r target

read -p "Clean up data? (Y): " cleanup

if [[ $cleanup == [yY] ]]
then
    docker volume rm postgres  
    docker volume rm proxy-data
fi