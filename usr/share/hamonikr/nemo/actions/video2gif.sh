#!/bin/bash

# Convert video to gif
# depends on ffmpeg (apt install ffmpeg)
#
# Usage 
# convert_gif.sh video_file (scale) (fps)
#
# https://superuser.com/questions/556029/how-do-i-convert-a-video-to-gif-using-ffmpeg-with-reasonable-quality


# Function to display error messages, either in the terminal or via zenity in a GUI environment
display_error() {
    local message="$1"
    local message_ko="${2:-$1}"

    if [ -n "$DISPLAY" ]; then
        if [[ $(locale | grep LANG) == *"ko_KR"* ]]; then
            zenity --error --text="$message_ko"
        else
            zenity --error --text="$message"
        fi
    else
        echo "$message"
    fi
}


# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    display_error "ffmpeg is not installed. Please install it by running 'apt install ffmpeg'" "ffmpeg가 설치되지 않았습니다. 'apt install ffmpeg'를 실행하여 설치해 주세요."
    exit 1
fi


# Check if input file exists
if [[ ! -f "$1" ]] ; then
    display_error "File name contains space or characters that cannot be processed." "파일 이름에 처리할 수 없는 공백이나 특수문자가 있습니다."
    exit 1
fi

# Convert the input file to an absolute path
input_file="$(realpath "$1")"

# Extract the filename without extension and the extension
filename=$(basename -- "$input_file")
extension="${filename##*.}"
filename_noext="${filename%.*}"

# Get the directory of the input file
input_dir=$(dirname -- "$input_file")
# Set the output file path to be in the same directory as the input file
output_file="${input_dir}/${filename_noext}.gif"

# Check if output file already exists
if [ -f "$output_file" ]; then
    if [ -n "$DISPLAY" ]; then
        if [[ $(locale | grep LANG) == *"ko_KR"* ]]; then
            if zenity --question --text="동일한 이름의 gif 파일이 이미 존재합니다. 덮어쓰시겠습니까?"; then
                rm -fv "$output_file"
            else
                display_error "Operation cancelled." "작업이 취소되었습니다."
                exit 1
            fi
        else
            if zenity --question --text="Output gif file already exists. Do you want to overwrite it?"; then
                rm -fv "$output_file"
            else
                display_error "Operation cancelled." "작업이 취소되었습니다."
                exit 1
            fi
        fi
    else
        read -p "Output gif file already exists. Do you want to overwrite it? (y/n): " choice
        if [[ "$choice" == "y" || "$choice" == "Y" ]]; then
            rm -fv "$output_file"
        else
            display_error "Operation cancelled." "작업이 취소되었습니다."
            exit 1
        fi
    fi
fi


# Convert video to gif based on extension
if [[ "$extension" == "avi" || "$extension" == "mp4" ]]; then
    ffmpeg -i "$input_file" "${output_file}"
else
    palette="/tmp/${filename_noext}_palette.png"
    ffmpeg -y -i "$input_file" -vf fps=${3:-10},scale=${2:-600}:-1:flags=lanczos,palettegen "$palette"
    ffmpeg -i "$input_file" -i "$palette" -filter_complex "fps=${3:-10},scale=${2:-600}:-1:flags=lanczos[x];[x][1:v]paletteuse" "${output_file}"
fi

# Remove the palette if it was generated
if [ -f "$palette" ]; then
    rm "$palette"
fi
