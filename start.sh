#!/bin/bash

# ANSI 颜色代码
RESET='\033[0m'
BOLD='\033[1m'
RED='\033[31m'
GREEN='\033[32m'
YELLOW='\033[33m'
BLUE='\033[34m'
GRAY='\033[90m'

# 图标模板
ICON_CHECK="${GREEN}✅${RESET}"
ICON_CROSS="${RED}X${RESET}"
ICON_WARN="${YELLOW}⚠️${RESET}"
ICON_INFO="${BLUE}🔍${RESET}"
ICON_START="${GREEN}🚀${RESET}"
ICON_STOP="${RED}🛑${RESET}"
ICON_GEAR="${YELLOW}⚙️${RESET}"
ICON_BOOK="${BLUE}📖${RESET}"
ICON_HAPPY="${GREEN}😄${RESET}"
ICON_SAD="${RED}😢${RESET}"

# ====== 配置参数 ======
SESSION_BACK="nads_project_back"
SESSION_FRONT="nads_project_front"
FRONTEND_PORT=3000      # Node 服务端口
BACKEND_PORT=8000       # PHP 服务端口
FRONTEND_DIR="/var/www/html/nads/front"
BACKEND_DIR="/var/www/html/nads/back"
FRONTEND_LOG="front.log"
BACKEND_LOG="back.log"

# ====== 检测并终止单个服务函数 ======
confirm_and_kill() {
    local port=$1
    local name=$2

    echo -e "${ICON_INFO} 正在检测 ${name} 服务是否运行..."

    # 使用 ss 替代 lsof（无需 sudo）
    pid=$(ss -tulnp | grep ":$port" | awk '{print $2}' | cut -d',' -f1)

    if [ -z "$pid" ]; then
        echo -e "${ICON_CHECK} 未发现 ${name} 服务运行"
        return 0
    fi

    # 提示用户确认
    read -p "${ICON_STOP} 发现 ${name} 服务正在运行（PID: $pid），是否终止？(y/n): " choice
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
    return $?  # 0 表示存在，1 表示不存在
}

# ====== 清理无效 Screen 会话 ======
cleanup_screen_session() {
    local session_name=$1
    if check_screen_session "$session_name"; then
        echo "🧹 检测到旧会话 $session_name，尝试清理..."
        screen -S "$session_name" -X quit 2>/dev/null || echo "⚠️ 清理失败，尝试强制删除"
        rm -f /tmp/screen-$USER/*.$session_name 2>/dev/null
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
        command="cd $FRONTEND_DIR && npm run start >> $FRONTEND_LOG"
        log_file="$FRONTEND_LOG"
    else
        echo -e "${ICON_CROSS} 未知服务类型：$service_name"
        return 1
    fi

    echo -e "${ICON_START} 启动 $service_name 服务..."

    # 清理旧会话
    cleanup_screen_session "$session_name"

    echo -e "${ICON_GEAR} 建立新会话 $session_name"
    if ! screen -dmS "$session_name"; then
        echo -e "${ICON_CROSS} 无法创建会话 $session_name，检查权限或资源限制"
        return 1
    fi

    # 等待会话初始化
    sleep 1

    # 发送命令
    echo -e "${ICON_GEAR} 执行命令: $command"
    screen -S "$session_name" -X stuff "$command\n"

    echo -e "${ICON_CHECK} $service_name 服务已启动，日志记录到 $log_file"
}

read -p "${ICON_BOOK} 输入 stop（停止服务）/start（启动服务）, stop/start: " command_choice
command_choice=$(echo "$command_choice" | tr '[:upper:]' '[:lower:]')

if [ "$command_choice" = "start" ]; then
    echo -e "${ICON_START} 正在检测并启动服务..."

    # 初始化标志变量
    PHP_NEW=false
    NODE_NEW=false

    # 检测并终止 Node 服务
    confirm_and_kill $FRONTEND_PORT "Node"
    if [ $? -eq 0 ]; then
        echo -e "${ICON_CHECK} Node 服务已终止，准备启动新服务"
        NODE_NEW=true
    else
        echo -e "${ICON_WARN} Node 服务未终止，跳过启动"
    fi

    # 检测并终止 PHP 服务
    confirm_and_kill $BACKEND_PORT "PHP"
    if [ $? -eq 0 ]; then
        echo -e "${ICON_CHECK} PHP 服务已终止，准备启动新服务"
        PHP_NEW=true
    else
        echo -e "${ICON_WARN} PHP 服务未终止，跳过启动"
    fi

    # 启动服务
    if [ "$PHP_NEW" = "true" ]; then
        start_services "PHP"
    fi

    if [ "$NODE_NEW" = "true" ]; then
        start_services "NODE"
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
else
    echo -e "${ICON_SAD} 无效输入，默认取消操作! Crying!"
fi