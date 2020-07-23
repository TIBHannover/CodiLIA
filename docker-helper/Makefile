
all: build-docker runtime-docker

build-docker:
	docker build -t codilia/build -f "build/Dockerfile" "build"

runtime-docker: runtime/fonts
	docker build -t codilia/runtime -f "runtime/Dockerfile" "runtime"

runtime/fonts:Noto-unhinted.zip
	unzip -d $@ $<

Noto-unhinted.zip:
	wget https://noto-website-2.storage.googleapis.com/pkgs/Noto-unhinted.zip
