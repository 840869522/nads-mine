import { remark } from 'remark';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import remarkGfm from 'remark-gfm';

/**
 * 修复不完整的 Markdown 语法
 * @param text 待修复的 Markdown 文本
 * @returns 修复后的 Markdown 文本
 */
export const fixIncompleteMarkdown = (text: string): string => {
    // 配置remark处理器（移除无效的handlers配置）
    const processor = remark()
        .use(remarkParse)
        .use(remarkGfm) // 支持GitHub Flavored Markdown
        .use(remarkStringify, {
            bullet: '-',
            emphasis: '*',
            fence: '`',
            fences: true,
            incrementListMarker: false,
            listItemIndent: 'one', // 已通过此选项控制缩进，无需handlers
            rule: '-',
            ruleRepetition: 3,
            ruleSpaces: true,
            strong: '*',
            tightDefinitions: false
        });

    try {
        // 1. 使用remark解析并重新生成Markdown
        const ast = processor.parse(text);
        let fixedText = processor.stringify(ast);

        // 2. 修复remark可能无法处理的特殊情况
        // 修复未闭合的代码块
        const codeFenceCount = (fixedText.match(/```/g) || []).length;
        if (codeFenceCount % 2 !== 0) {
            fixedText += '\n```';
        }

        // 修复未闭合的链接
        const linkOpen = (fixedText.match(/\[/g) || []).length;
        const linkClose = (fixedText.match(/]\(/g) || []).length;
        if (linkOpen > linkClose) {
            fixedText += ']()';
        }

        // 3. 修复特殊字符问题（如破折号）
        fixedText = fixedText
            .replace(/‑bit/g, '-bit')
            .replace(/\\n/g, '<br>');

        // 4. 修复表格问题
        // 确保表格分隔符正确
        fixedText = fixedText.replace(/(\|.*\|)\n(?!\|)/g, '$1\n| --- |\n');

        // 修复表格分隔符不匹配问题
        fixedText = fixedText.replace(/\|.*\|\s*\n(\|[-:\s|]+)\|/g, (match, p1) => {
            const separatorCount = (p1.match(/\|/g) || []).length;
            const expectedCount = (match.match(/\|/g) || []).length - 1;
            if (separatorCount < expectedCount) {
                return match.replace(/\|[-:\s|]+\|/, `|${' --- |'.repeat(expectedCount - 1)}`);
            }
            return match;
        });

        // 5. 确保表格行结束
        fixedText = fixedText.replace(/(\|.*\|)\n(?!\|)/g, '$1\n| --- |\n');

        return fixedText;
    } catch (error) {
        console.error('Error fixing Markdown:', error);
        return applyBasicFixes(text);
    }
};

/**
 * 应用基本修复（当remark处理失败时使用）
 * @param text Markdown文本
 * @returns 修复后的文本
 */
const applyBasicFixes = (text: string): string => {
    // 修复基础结构问题
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    text = text.replace(/\n{3,}/g, '\n\n');

    // 修复未闭合的代码块
    const codeFenceCount = (text.match(/```/g) || []).length;
    if (codeFenceCount % 2 !== 0) {
        text += '\n```';
    }

    // 修复未闭合的链接/图片
    const linkOpen = (text.match(/\[/g) || []).length;
    const linkClose = (text.match(/]\(/g) || []).length;
    if (linkOpen > linkClose) {
        text += ']()';
    }

    return text;
};

/**
 * 检查 Markdown 是否处于安全渲染状态
 * @param text 当前文本
 * @returns 是否可以安全渲染
 */
export const isSafeToRender = (text: string): boolean => {
    try {
        // 1. 基本语法检查
        const codeFenceCount = (text.match(/```/g) || []).length;
        if (codeFenceCount % 2 !== 0) return false;

        const asterisks = (text.match(/\*/g) || []).length;
        if (asterisks % 2 !== 0) return false;

        const underscores = (text.match(/_/g) || []).length;
        if (underscores % 2 !== 0) return false;

        const linkOpen = (text.match(/\[/g) || [])?.length;
        const linkClose = (text.match(/]\(/g) || []).length;
        if (linkOpen > linkClose) return false;

        // 2. 安全内容检查
        // 检查危险的HTML标签
        if (/<script|<iframe|on\w+=/i.test(text)) return false;

        // 检查危险的链接协议
        if (/]\(javascript:/i.test(text)) return false;

        // 3. 使用remark进行深度检查
        const ast = remark().use(remarkParse).parse(text);
        return !containsDangerousNodes(ast);
    } catch (error) {
        return false;
    }
};

/**
 * 检查AST是否包含潜在危险的节点
 * @param node AST节点
 * @returns 是否包含危险节点
 */
const containsDangerousNodes = (node: any): boolean => {
    if (!node || typeof node !== 'object') return false;

    // 检查危险的HTML标签
    if (node.type === 'html' && /<script|<iframe|on\w+=/i.test(node.value)) {
        return true;
    }

    // 检查危险的链接
    if (node.type === 'link' && node.url && /^javascript:/i.test(node.url)) {
        return true;
    }

    // 检查内联代码中的危险内容
    if (node.type === 'inlineCode' && /<\/?script/i.test(node.value)) {
        return true;
    }

    // 递归检查子节点
    if (node.children && Array.isArray(node.children)) {
        return node.children.some(containsDangerousNodes);
    }

    return false;
};