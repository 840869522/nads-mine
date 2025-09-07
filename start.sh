#!/bin/bash

# ANSI 颜色代码
RESET='\e[0m'
BOLD='\e[1m'
RED='\e[31m'
GREEN='\e[32m'
YELLOW='\e[33m'
BLUE='\e[34m'
GRAY='\e[90m'


ICON_CHECK="${GREEN}[OK]${RESET}"
ICON_CROSS="${RED}[ERROR]${RESET}"
ICON_WARN="${YELLOW}[WARN]${RESET}"
ICON_INFO="${BLUE}[INFO]${RESET}"
ICON_START="${GREEN}[START]${RESET}"
ICON_STOP="${RED}[STOP]${RESET}"
ICON_GEAR="${YELLOW}[CFG]${RESET}"
ICON_BOOK="${BLUE}[HELP]${RESET}"
ICON_HAPPY="${GREEN}[OK]${RESET}"
ICON_SAD="${RED}[FAIL]${RESET}"

SCRIPT_PATH=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT_PATH")

# ====== 配置参数 ======
SESSION_BACK="nads_project_back"
SESSION_FRONT="nads_project_front"
SESSION_PYTHON="nads_project_python"
FRONTEND_PORT=3000      # Node 服务端口
BACKEND_PORT=8000       # PHP 服务端口
CHAT_PORT=9009
FRONTEND_DIR="$SCRIPT_DIR/src"
BACKEND_DIR="$SCRIPT_DIR/back"
CHAT_DIR="$SCRIPT_DIR/langchain"
FRONTEND_LOG="$FRONTEND_DIR/front.log"
BACKEND_LOG="$BACKEND_DIR/back.log"
CHAT_LOG="$BACKEND_DIR/chat.log"

# ====== 检测并终止单个服务函数 ======
confirm_and_kill() {
    local port=$1
    local name=$2
    local cmd_filter

    echo -e "${ICON_INFO} 正在检测 ${name} 服务是否运行..."
    pid=$(sudo lsof -t -i:$port 2>/dev/null)

    if [ -z "$pid" ]; then
        echo -e "${ICON_CHECK} 未发现 ${name} 服务运行"
        return 0
    fi

    read -p "发现 ${name} 服务正在运行（PID: $pid），是否终止？(y/n): " choice
    case "$choice" in
        y|Y )
            echo -e "${ICON_STOP} 正在终止 ${name} 服务..."
            sudo kill -9 $pid 2>/dev/null && echo -e "${ICON_CHECK} ${name} 服务已终止" || echo -e "${ICON_CROSS} 终止失败，请手动处理 PID $pid"
            sleep 2
            return 0
        ;;
        n|N )
            echo -e "${ICON_WARN} 用户取消终止 ${name} 服务，操作中断"
            return 1
        ;;
        * )
            echo -e "${ICON_WARN} 无效输入，默认取消操作"
            return 1
        ;;
    esac
}

# ====== 检查 Screen 会话是否存在 ======
check_screen_session() {
    local session_name=$1
    screen -ls | grep -q "$session_name"
    return $?
}

# ====== 清理无效 Screen 会话 ======
cleanup_screen_session() {
    local session_name=$1
    if check_screen_session "$session_name"; then
        echo -e "🧹 检测到旧会话 $session_name，尝试清理..."
        screen -S "$session_name" -X quit 2>/dev/null || echo -e  "${YELLOW}⚠️${RESET} 清理失败，尝试强制删除"
        rm -f /tmp/screen-$USER/*.$session_name 2>/dev/null
    fi
}

# ====== 测试服务 ======
test_services() {
    local app_name=$1
    local http_code
    local time_out=5
    local port
    local url="http://localhost"
    if [ "$app_name" = "PHP" ]; then 
        url="$url:8000"
        port=8000
    fi
    if [ "$app_name" = "Node" ]; then
        url="$url:3000"
        port=3000
    fi
    if ["$app_name" = "Python"]; then
        url="$url:9009"
        port=9009
    fi
    echo "测试 $app_name 服务, 地址为 $url ..."
    http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time $time_out "$url")
    if [ $http_code -eq 200 ]; then
        echo -e "${GREEN}[SUCCESS] 请求成功，HTTP状态码: $http_code ${RESET}"
    elif [ $http_code -ge 400 ] && [ $http_code -lt 500 ]; then
        echo -e "[CLIENT ERROR] 客户端错误，状态码: $http_code"
    elif [ $http_code -ge 500 ] && [ $http_code -lt 600 ]; then
        echo -e "${RED}[SERVER ERROR] 服务器错误，状态码: $http_code${RESET}"
    else
        echo -e "${YELLOW}[UNKNOWN] 未知状态码: $http_code${RESET}"
        echo -e "${ICON_INFO} 正在检测 ${app_name} 服务是否运行..."
        pid_test=$(sudo lsof -t -i:$port 2>/dev/null)

        if [ -z "$pid_test" ]; then
            echo -e "${ICON_CHECK} 未发现 ${app_name} 服务运行"
        else
            echo "发现 ${app_name} 服务正在运行（PID: $pid_test）"
        fi
    fi
}

# ====== 启动新服务 ======
start_services() {
    local service_name=$1
    local session_name
    local command
    local log_file

    if [ "$service_name" = "PHP" ]; then
        session_name="$SESSION_BACK"
        command="cd $BACKEND_DIR && sudo php artisan serve >> $BACKEND_LOG"
        log_file="$BACKEND_LOG"
    elif [ "$service_name" = "NODE" ]; then
        session_name="$SESSION_FRONT"
        read -p "选择前端运行模式 dev or build: " mode
        if [ "$mode" = "build" ]; then
            command="cd $FRONTEND_DIR && npm install && npm run build || exit 1 && npm start >> $FRONTEND_LOG"
        elif [ "$mode" = "dev" ]; then 
            command="cd $FRONTEND_DIR && npm run dev >> $FRONTEND_LOG"
        else 
            echo "无效的输入，以build模式运行前端服务"
            command="cd $FRONTEND_DIR && npm run build && npm start >> $FRONTEND_LOG"
        fi
        log_file="$FRONTEND_LOG"
    elif [ "$service_name" = "Python" ]; then
        session_name="$SESSION_PYTHON"
        command="cd $CHAT_DIR && source /var/www/chatenv/bin/activate && python main.py >> $CHAT_LOG"
         log_file="$CHAT_LOG"
    else
        echo -e "${ICON_CROSS} 未知服务类型：$service_name"
        return 1
    fi

    echo -e "${ICON_START} 启动 $service_name 服务..."

    cleanup_screen_session "$session_name"

    echo -e "${ICON_GEAR} 建立新会话 $session_name"
    if ! screen -dmS "$session_name"; then
        echo -e "${ICON_CROSS} 无法创建会话 $session_name，检查权限或资源限制"
        return 1
    fi

    sleep 1

    echo -e "${ICON_GEAR} 执行命令: $command"
    screen -S "$session_name" -X stuff "$command\n"

    echo -e "${ICON_CHECK} $service_name 服务已启动，日志记录到 $log_file"
}


# ====== 帮助文档函数 ======
show_help() {
cat << EOF
使用指南: ./start.sh [command]

启动服务: 
  ./start.sh start

停止服务:
  ./start.sh stop

测试服务:
  ./start.sh test

帮助信息:
  ./start.sh -h | --help

交互模式:
  直接运行 ./start.sh 将进入交互式菜单
EOF
}

# ====== 参数解析 ======
if [ $# -gt 0 ]; then
    case $(echo "$1" | tr '[:upper:]' '[:lower:]') in
        start|stop|test)
            command_choice=$(echo "$1" | tr '[:upper:]' '[:lower:]')
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${ICON_CROSS} 错误：无效参数 '$1'"
            show_help
            exit 1
            ;;
    esac
else
    read -p "${ICON_BOOK} 输入 stop（停止服务）/start（启动服务）/test（测试服务）, stop/start/test: " command_choice
    command_choice=$(echo "$command_choice" | tr '[:upper:]' '[:lower:]')
fi

if [ "$command_choice" = "start" ]; then
    echo -e "${ICON_START} 正在检测并启动服务..."

    PHP_NEW=false
    NODE_NEW=false
    PYTHON_NEW=false

    confirm_and_kill $FRONTEND_PORT "Node"
    if [ $? -eq 0 ]; then
        echo -e "${ICON_CHECK} Node 服务已终止，准备启动新服务"
        NODE_NEW=true
    else
        echo -e "${ICON_WARN} Node 服务未终止，跳过启动"
    fi

    confirm_and_kill $BACKEND_PORT "PHP"
    if [ $? -eq 0 ]; then
        echo -e "${ICON_CHECK} PHP 服务已终止，准备启动新服务"
        PHP_NEW=true
    else
        echo -e "${ICON_WARN} PHP 服务未终止，跳过启动"
    fi
    
    confirm_and_kill $CHAT_PORT "Chat"
    if [ $? -eq 0 ]; then
        echo -e "${ICON_CHECK} CHAT 服务已终止，准备启动新服务"
        PHP_NEW=true
    else
        echo -e "${ICON_WARN} CHAT 服务未终止，跳过启动"
    fi
    if [ "$PHP_NEW" = "true" ]; then
        start_services "PHP"
    fi

    if [ "$NODE_NEW" = "true" ]; then
        start_services "NODE"
    fi

    if [ "$PYTHON_NEW" = "true" ]; then
        start_services "Python"
    fi

    echo -e "${ICON_HAPPY} Happy! 启动流程已结束！"
elif [ "$command_choice" = "stop" ]; then
    confirm_and_kill $BACKEND_PORT "PHP"
    if [ $? -eq 0 ]; then
        cleanup_screen_session "$SESSION_BACK"
    fi

    confirm_and_kill $FRONTEND_PORT "NODE"
    if [ $? -eq 0 ]; then 
        cleanup_screen_session "$SESSION_FRONT"
    fi

    echo -e "${ICON_HAPPY} Happy! 停止流程已结束！"
elif [ "$command_choice" = "test" ]; then
    test_services "PHP"
    test_services "Node"
else
    show_help
    echo -e "${ICON_SAD} 无效输入，默认取消操作! Crying!"
fi
