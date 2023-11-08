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

# Function to calculate and display progress
display_progress() {
    local pid=$1
    local duration=$2
    local logfile=$3

    echo "0" > "$logfile" # Initialize log file

    # Convert duration to seconds if it is not already
    local total_seconds=$(echo "$duration" | awk '{print int($1)}')

    # Define messages based on locale
    local title_en="Converting..."
    local title_ko="변환 중..."
    local text_en="Converting video to GIF..."
    local text_ko="비디오 파일을 GIF로 변환 중..."

    local title="$title_en"
    local text="$text_en"

    # Check for Korean locale and update messages
    if [[ $(locale | grep LANG) == *"ko_KR"* ]]; then
        title="$title_ko"
        text="$text_ko"
    fi

    # While ffmpeg is running
    while kill -0 "$pid" 2>/dev/null; do
        sleep 1
        # Get the current time from the log file
        local current_time=$(grep 'time=' "$logfile" | tail -1 | sed -e 's/.*time=\([^ ]*\).*/\1/')
        # Convert current_time to seconds
        local current_seconds=$(echo "$current_time" | awk -F: '{ if (NF == 1) {print $1} else if (NF == 2) {print $1*60 + $2} else {print $1*3600 + $2*60 + $3} }')
        # Calculate the percentage
        local percentage=$(echo "scale=2; $current_seconds / $total_seconds * 100" | bc -l)

        # Update the progress bar
        echo "$percentage"
    done | zenity --progress --title="$title" --text="$text" --percentage=0 --auto-close --width=400
}


# Function to convert HH:MM:SS.xxx to seconds
convert_to_seconds() {
    local total_seconds=0
    local hours_minutes_seconds=($1)
    local split=(${hours_minutes_seconds//:/ })
    total_seconds=$(echo "${split[0]} * 3600 + ${split[1]} * 60 + ${split[2]}" | bc)
    echo "$total_seconds"
}

# Convert video to gif based on extension
if [[ "$extension" == "avi" || "$extension" == "mp4" || "$extension" == "mkv" || "$extension" == "webm" ]]; then
    # ffmpeg -i "$input_file" "${output_file}"

    # Extract duration using ffprobe
    duration=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$input_file")

    # Ensure that duration is a number
    if ! [[ "$duration" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
        display_error "Failed to retrieve the duration of the video." "비디오 파일의 길이를 확인할 수 없습니다."
        exit 1
    fi

    # Start ffmpeg conversion process in the background and get its PID
    # If wish original scale use -1
    ffmpeg -i "$input_file" -vf "fps=10,scale=800:-1:flags=lanczos" -c:v gif -y "$output_file" -progress /tmp/ffmpeg-progress.log &
    pid=$!

    # Display progress bar
    display_progress "$pid" "$duration" "/tmp/ffmpeg-progress.log"

    # Check if ffmpeg finished successfully
    if [ $? -ne 0 ]; then
        display_error "The conversion has been interrupted." "변환 작업이 중단되었습니다."
        exit 1
    fi 
    
else
    palette="/tmp/${filename_noext}_palette.png"
    ffmpeg -y -i "$input_file" -vf fps=${3:-10},scale=${2:-800}:-1:flags=lanczos,palettegen "$palette"
    ffmpeg -i "$input_file" -i "$palette" -filter_complex "fps=${3:-10},scale=${2:-600}:-1:flags=lanczos[x];[x][1:v]paletteuse" "${output_file}"
fi

# Remove the palette if it was generated
if [ -f "$palette" ]; then
    rm "$palette"
fi

# Remove the ffmpeg progress log file
if [ -f "/tmp/ffmpeg-progress.log" ]; then
    rm -f /tmp/ffmpeg-progress.log
fi