#!/bin/bash
mkdir -p ~/.config/yt-dlp
echo '--no-check-certificate
--compat-options no-certifi
--force-ipv4
--geo-bypass
--ignore-errors
--no-warnings
--retries 3
--socket-timeout 30
--source-address 0.0.0.0
--limit-rate 2M
--add-metadata
--embed-thumbnail
--parse-metadata "title:%(meta_title)s"
--parse-metadata "uploader:%(meta_artist)s"' > ~/.config/yt-dlp/config