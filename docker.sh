docker run -d \
  -v /home/lzh:/app/lzh \
  -p 10001:10000 \
  -p 3000:3000 \
  --user 1000:1000 \
  file-manager