## hamonikr-system
이 패키지는 하모니카OS의 기본 환경을 구성하는 필수 패키지입니다.

패키지를 설치했지만, 하모니카 환경을 사용하고 싶지 않은 경우, 

다음과 같이 설정하여 시스템 전역에서 하모니카 시스템 서비스를 구동하지 않을 수 있습니다.

```
# etc/hamonikr/hamonikrSystem.conf
[global]
enable = False
```

## 주요 구성 요소

### Structure

- debian : 패키지 빌드
- etc/hamonikr : 하모니카OS 정보
- etc/hamonikr/apt : apt pinning
- etc/hamonikr/adjustments : 하모니카OS 환경 설정
- etc/hamonikr/templates : 다양한 설정 기본 파일
- etc/init.d : hamonikr-system 서비스 구동 파일
- etc/skel : 계정 생성 기본 파일들
- etc/xdg/autostart : 데스크톱 시작 프로그램
- usr/lib/hamonikr/hamonikr-system : 시스템 설정 실행 프로그램 (hamonikr-adjust.py)
- usr/local/bin : 데스크톱 테마 적용 프로그램 (update-dconf-setting)
- share : 하모니카OS 구동에 필요한 리소스

### 하모니카 시스템 서비스

- hamonikr-system.service

### APT pinning

- etc/apt/apt.conf.d/00hamonikr
- etc/apt/preferences.d/hamonikr.pref

### 하모니카 배포본 정보

- /etc/hamonikr/info
- /etc/hamonikr/lsb-release
- /etc/hamonikr/os-release
- /usr/lib/os-release

### ssh 터미널 접속시 보여줄 정보

- /etc/hamonikr/issue
- /etc/hamonikr/issue.net

## For Developer

설정을 변경하는 것은 `시스템 전역적으로 root 권한으로 해야하는 일`과 `개별 사용자의 환경에서 해야 하는 일`이 구분되어야 합니다.
반드시 아래의 방법을 준수하세요.

### `시스템 전역적으로 root 권한으로 해야하는 일` 을 변경하는 방법

etc/hamonikr/adjustments 안에 수정을 원하는 파일을 작성하면 시스템 시작시 적용됩니다.

여기 포함된 파일들은 아래와 같은 확장자로 구분해서 각각의 동작이 실행됩니다.

 * .execute : 실행이 되는 파일이며 실행권한 필요 (매번 반복)
 * .execute-once : 1회만 실행이 되는 파일이며 실행권한 필요
 * .overwrite : 공백으로 구분된 2개의 필드로 원본과 덮어쓰기 할 대상을 입력하면 적용. 대상이 없는 경우 패스
 * .preserve : 덮어쓰기 하지 않을 파일을 한줄씩 입력하면 시스템 변경시 제외된다.
 * .menu : 데스크톱에 나오는 메뉴를 조정하는 파일로 'exec, hide, show, onlyshowin, rename, categories' 같은 지시어를 사용

    ```
    exec /usr/shar/fglrx/amdccclesu.desktop gksu /usr/bin/amdcccle;
    hide /usr/shar/applications/xfce-file-manager.desktop;
    categories /usr/shar/applications/libreoffice-draw.desktop Office;
    ```

#### 시스템 전역 변경사항 디버깅
실행 기록은 /var/log/hamonikr-system.log 파일에 기록되며 아래와 같은 내용이 남습니다.
```
--------------------
Execution time: 0:00:00.657935
2022-10-08 10:21:46 - hamonikr system started
Executed:
  /etc/hamonikr/adjustments/adjust-grub-title.execute
  /etc/hamonikr/adjustments/count-user.execute
Executed Once:
Replaced:
Edited:
Skipped:
  /usr/share/applications/firefox.desktop
  /usr/share/applications/xed.desktop
  /usr/share/cups/data/default-testpage.pdf
```

또는

/var/log/syslog 안에서 hamonikr-system 로그를 확인할 수도 있습니다.

### `개별 사용자의 환경에서 해야 하는 일` 을 변경하는 방법

데스크톱 환경으로 진입하면 `/etc/xdg/autostart/hamonikr-user-env.desktop` 파일이 실행되고, 
실제 수정은 `/usr/local/bin/set-user-env` 파일이 사용자 환경 설정을 적용합니다.
사용자 환경이 적용된 로그파일은 `HOME/.hamonikr/log/set-user-env.log` 파일을 확인하세요. 

이전 환경으로 복원하시려면 아래와 같이 터미널에 입력하세요.

```
set-user-env restore
```

#### 개별 사용자 변경사항 디버깅
실행 기록은 $HOME/.hamonikr/log/ 경로에 실행파일명.log 파일로 기록되며 아래와 같은 내용이 남습니다.
```
2022-10-11_12:47_16 set-user-env : Started...
2022-10-11_12:47_16 set-user-env : Succeed backup from previous settings.
2022-10-11_12:47_16 set-user-env : Update hamonikr default logo setting
2022-10-11_12:47_16 set-user-env : Deleted cache
2022-10-11_12:47_16 set-user-env : Copy applets
2022-10-11_12:47_16 set-user-env : Update default terminal settings
2022-10-11_12:47_16 set-user-env : Update default nimf settings
2022-10-11_12:47_16 set-user-env : update search provider settings
2022-10-11_12:47_16 set-user-env : Update hamonikr community link icon
2022-10-11_12:47_16 set-user-env : Created set-user-env.done file
2022-10-11_13:23_02 set-user-env : Started...
```