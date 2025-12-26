#!/bin/bash

# Docker 데몬 확인 및 실행
if ! docker info > /dev/null 2>&1; then
  echo "Docker가 실행 중이지 않습니다. Docker Desktop을 시작합니다..."
  open -a Docker
  
  echo "Docker가 시작될 때까지 대기 중..."
  # 타임아웃 설정 (예: 60초)
  count=0
  while ! docker info > /dev/null 2>&1; do
    sleep 2
    echo -n "."
    count=$((count+1))
    if [ $count -ge 30 ]; then
        echo ""
        echo "Docker 시작 시간이 너무 오래 걸립니다. 수동으로 확인해주세요."
        exit 1
    fi
  done
  echo ""
  echo "Docker가 준비되었습니다!"
fi

# MinIO 서비스 시작
echo "MinIO 서비스를 시작합니다..."
docker-compose up -d

# 상태 확인
if [ $? -eq 0 ]; then
    echo "MinIO 서비스가 성공적으로 시작되었습니다 (Port 9000, 9001)."
    docker ps | grep minio
else
    echo "MinIO 서비스 시작에 실패했습니다."
fi
