#!/bin/bash

echo "MinIO 서비스를 종료합니다..."
docker-compose down

if [ $? -eq 0 ]; then
    echo "MinIO 서비스가 성공적으로 종료되었습니다."
else
    echo "MinIO 서비스 종료에 실패했습니다."
    exit 1
fi

