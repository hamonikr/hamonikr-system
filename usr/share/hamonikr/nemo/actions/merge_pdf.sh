#!/bin/bash

# 원래 IFS 값을 저장
OIFS="$IFS"
# IFS를 줄바꿈 문자로 설정
IFS=$'\n'

# Output file name
output="merged.pdf"

# Get the directory of the first selected file
output_dir="$(dirname "$1")"

# Check if any files are passed
if [ "$#" -lt 1 ]; then
    if [ "${LANG:0:2}" == "ko" ]; then
        zenity --error --text="선택된 파일이 없습니다!"
    else
        zenity --error --text="No files selected!"
    fi
    exit 1
fi

# 파일 목록을 저장할 배열 생성
files=()

# 모든 인자를 순회하며 파일 목록에 추가
for file in "$@"; do
    files+=("$file")
done

# Merge PDF files
pdfunite "${files[@]}" "$output_dir/$output"

if [ $? -eq 0 ]; then
    if [ "${LANG:0:2}" == "ko" ]; then
        zenity --info --text="PDF 파일이 성공적으로 병합되었습니다: '$output_dir/$output'"
    else
        zenity --info --text="PDF files merged successfully into '$output_dir/$output'"
    fi
else
    if [ "${LANG:0:2}" == "ko" ]; then
        zenity --error --text="PDF 파일 병합에 실패했습니다"
    else
        zenity --error --text="Failed to merge PDF files"
    fi
fi

# IFS를 원래 값으로 복원
IFS="$OIFS"
