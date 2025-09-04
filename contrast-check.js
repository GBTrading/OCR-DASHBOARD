#!/usr/bin/env node
/**
 * ✅ PHASE 4B: Automated Contrast Verification Tool
 * 
 * This script checks WCAG 2.1 AA contrast compliance for all color combinations
 * used in the OCR Dashboard. It prevents accessibility regressions by validating
 * contrast ratios during build time.
 * 
 * Usage: node contrast-check.js
 * Exit code: 0 = all checks passed, 1 = contrast violations found
 */

const fs = require('fs');
const path = require('path');

// WCAG 2.1 AA Standards
const WCAG_AA_NORMAL = 4.5;  // Normal text minimum contrast ratio
const WCAG_AA_LARGE = 3.0;   // Large text minimum contrast ratio

/**
 * Convert hex color to RGB values
 * @param {string} hex - Hex color code (e.g., '#FFD700')
 * @returns {object} RGB values {r, g, b}
 */
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

/**
 * Calculate relative luminance of a color
 * @param {object} rgb - RGB color values {r, g, b}
 * @returns {number} Relative luminance (0-1)
 */
function getLuminance(rgb) {
    const { r, g, b } = rgb;
    const [rs, gs, bs] = [r, g, b].map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 * @param {string} color1 - First color (hex)
 * @param {string} color2 - Second color (hex)
 * @returns {number} Contrast ratio (1-21)
 */
function getContrastRatio(color1, color2) {
    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);
    
    if (!rgb1 || !rgb2) {
        throw new Error(`Invalid color format: ${color1} or ${color2}`);
    }
    
    const lum1 = getLuminance(rgb1);
    const lum2 = getLuminance(rgb2);
    
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    
    return (brightest + 0.05) / (darkest + 0.05);
}

/**
 * Check if contrast ratio meets WCAG AA standards
 * @param {number} ratio - Contrast ratio
 * @param {boolean} isLargeText - Whether text is considered large (18pt+ or 14pt+ bold)
 * @returns {object} Compliance status and level
 */
function checkWCAGCompliance(ratio, isLargeText = false) {
    const minimum = isLargeText ? WCAG_AA_LARGE : WCAG_AA_NORMAL;
    const passes = ratio >= minimum;
    
    return {
        passes,
        ratio: Math.round(ratio * 10) / 10,
        minimum,
        level: passes ? 'PASS' : 'FAIL'
    };
}

/**
 * Color combinations to test
 * Format: [description, foreground, background, isLargeText]
 */
const colorTests = [
    // Dark theme combinations
    ['Dark theme - Primary text on dark background', '#f1f5f9', '#0f172a', false],
    ['Dark theme - Secondary text on dark background', '#94a3b8', '#0f172a', false],
    ['Dark theme - Brand gold on dark background', '#FFD700', '#0f172a', false],
    ['Dark theme - Accent gold on dark background', '#D4A017', '#0f172a', false],
    
    // Light theme combinations (CRITICAL)
    ['Light theme - Primary text on white background', '#1e293b', '#ffffff', false],
    ['Light theme - Secondary text on white background', '#475569', '#ffffff', false],
    ['Light theme - Brand dark gold on white', '#8B6914', '#ffffff', false],
    ['Light theme - Brand medium gold on white', '#8B6914', '#ffffff', false],
    ['Light theme - Package secondary text', '#475569', '#ffffff', false],
    
    // Interactive elements
    ['Light theme - Focus border color', '#8B6914', '#ffffff', false],
    ['Dark theme - Focus border color', '#FFD700', '#0f172a', false],
    
    // Large text variants
    ['Light theme - Brand dark gold (large text)', '#8B6914', '#ffffff', true],
    ['Light theme - Brand medium gold (large text)', '#8B6914', '#ffffff', true],
    
    // Card backgrounds
    ['Light theme - Text on card background', '#1e293b', '#f8fafc', false],
    ['Dark theme - Text on card background', '#f1f5f9', '#1e293b', false],
];

/**
 * Run contrast verification checks
 */
function runContrastChecks() {
    console.log('🎨 OCR Dashboard - WCAG AA Contrast Verification');
    console.log('='.repeat(60));
    console.log(`Testing ${colorTests.length} color combinations...`);
    console.log();
    
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = [];
    
    colorTests.forEach(([description, foreground, background, isLargeText]) => {
        totalTests++;
        
        try {
            const ratio = getContrastRatio(foreground, background);
            const compliance = checkWCAGCompliance(ratio, isLargeText);
            
            const status = compliance.passes ? '✅ PASS' : '❌ FAIL';
            const textSize = isLargeText ? '(Large)' : '(Normal)';
            
            console.log(`${status} ${compliance.ratio}:1 ${textSize} - ${description}`);
            console.log(`      Foreground: ${foreground} | Background: ${background}`);
            console.log(`      Required: ${compliance.minimum}:1 | Actual: ${compliance.ratio}:1`);
            console.log();
            
            if (compliance.passes) {
                passedTests++;
            } else {
                failedTests.push({
                    description,
                    foreground,
                    background,
                    ratio: compliance.ratio,
                    required: compliance.minimum,
                    isLargeText
                });
            }
        } catch (error) {
            console.error(`❌ ERROR - ${description}: ${error.message}`);
            failedTests.push({ description, error: error.message });
            console.log();
        }
    });
    
    // Summary
    console.log('='.repeat(60));
    console.log(`📊 SUMMARY: ${passedTests}/${totalTests} tests passed`);
    
    if (failedTests.length === 0) {
        console.log('🎉 All contrast ratios meet WCAG AA standards!');
        console.log('✅ Your theme is accessibility compliant.');
        return 0; // Success exit code
    } else {
        console.log(`🚨 ${failedTests.length} contrast violations found:`);
        console.log();
        
        failedTests.forEach((failure, index) => {
            console.log(`${index + 1}. ${failure.description}`);
            if (failure.error) {
                console.log(`   Error: ${failure.error}`);
            } else {
                console.log(`   Colors: ${failure.foreground} on ${failure.background}`);
                console.log(`   Ratio: ${failure.ratio}:1 (required: ${failure.required}:1)`);
                console.log(`   Fix: Use a darker foreground or lighter background color`);
            }
            console.log();
        });
        
        console.log('❌ Please fix these contrast issues before deployment.');
        return 1; // Error exit code
    }
}

// Run the checks if this script is executed directly
if (require.main === module) {
    const exitCode = runContrastChecks();
    process.exit(exitCode);
}

module.exports = {
    runContrastChecks,
    getContrastRatio,
    checkWCAGCompliance,
    hexToRgb,
    getLuminance
};