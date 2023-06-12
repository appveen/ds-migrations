if [ ! $1 ]; then
    echo "Please Provide a version"
    exit 0;
fi
echo "Building Docker Image using tag: $1"

docker build -t odp-datastack-migration:$1 .

if [ $pushToDockerHub ]; then
    docker tag odp-datastack-migration:$1 appveen/odp-datastack-migration:$1
    docker push appveen/odp-datastack-migration:$1
fi