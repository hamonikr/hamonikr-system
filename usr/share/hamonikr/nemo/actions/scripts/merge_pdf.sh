#!/bin/bash

# Output file name
output="merged.pdf"

# Get the directory of the first selected file
output_dir=$(dirname "$1")

# Check if any files are passed
if [ "$#" -lt 1 ]; then
    if [ "${LANG:0:2}" == "ko" ]; then
        zenity --error --text="선택된 파일이 없습니다!"
    else
        zenity --error --text="No files selected!"
    fi
    exit 1
fi

# Merge PDF files
pdfunite "$@" "$output_dir/$output"

if [ $? -eq 0 ]; then
    if [ "${LANG:0:2}" == "ko" ]; then
        zenity --info --text="PDF 파일이 성공적으로 병합되었습니다: $output_dir/$output"
    else
        zenity --info --text="PDF files merged successfully into $output_dir/$output"
    fi
else
    if [ "${LANG:0:2}" == "ko" ]; then
        zenity --error --text="PDF 파일 병합에 실패했습니다"
    else
        zenity --error --text="Failed to merge PDF files"
    fi
fi
