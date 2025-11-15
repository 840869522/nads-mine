import winston from 'winston';
import "winston-daily-rotate-file";
import process from "process";
import dotenv from "dotenv";

dotenv.config();

const formatLocalTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

console.log("env",process.env)
const Logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
            // 自定义日志格式，包含时间、文件和错误信息
            const formattedTime = formatLocalTime();
            const fileInfo = meta.file || 'unknown';
            const errorMessage = meta.error || message;
            return `[${formattedTime}]::[${fileInfo}]::[${level.toUpperCase()}]::${errorMessage}${meta.stack ? `\nStack: ${meta.stack}` : ''}`;
        })
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.printf(({ message }) => {
                return message;
            })
        }),
        new winston.transports.DailyRotateFile({
            filename: `${process.env.LOG_DIR || 'logs'}/application-%DATE%.log`,
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: process.env.LOG_MAX_SIZE || '20m',
            maxFiles: process.env.LOG_MAX_FILES || '14d',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    const formattedTime = formatLocalTime();
                    const fileInfo = meta.file || 'unknown';
                    const errorMessage = meta.error || message;
                    return `[${formattedTime}]::[${fileInfo}]::[${level.toUpperCase()}]::${errorMessage}`;
                })
            )
        }),
        // 错误日志文件
        new winston.transports.DailyRotateFile({
            filename: `${process.env.LOG_DIR || 'logs'}/error-%DATE%.log`,
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: process.env.LOG_MAX_SIZE || '20m',
            maxFiles: process.env.LOG_ERROR_MAX_FILES || '30d',
            level: 'error',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    const formattedTime = formatLocalTime();
                    const fileInfo = meta.file || 'unknown';
                    const errorMessage = meta.error || message;
                    return `[${formattedTime}]::[${fileInfo}]::[${level.toUpperCase()}]::${errorMessage}${meta.stack ? `\nStack: ${meta.stack}` : ''}`;
                })
            )
        })
    ]
});

export {
    Logger,
    formatLocalTime
};