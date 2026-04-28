import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { markdownToBeehiivHtml } from '@/lib/authoring/markdown-to-beehiiv';

describe('markdownToBeehiivHtml', () => {
  test('should_drop_h1_headings', () => {
    const html = markdownToBeehiivHtml('# Title\n\nbody');
    assert.equal(html.includes('<h1'), false);
    assert.match(html, /body/);
  });

  test('should_render_h2_with_inline_styles', () => {
    const html = markdownToBeehiivHtml('## Section');
    assert.match(html, /<h2[^>]+>Section<\/h2>/);
    assert.match(html, /font-family:Georgia/);
  });

  test('should_render_paragraphs', () => {
    const html = markdownToBeehiivHtml('Hello world.');
    assert.match(html, /<p[^>]+>Hello world\.<\/p>/);
  });

  test('should_render_bold_inline', () => {
    const html = markdownToBeehiivHtml('**Bold** text');
    assert.match(html, /<strong[^>]+>Bold<\/strong>/);
  });

  test('should_render_links_with_utm_source', () => {
    const html = markdownToBeehiivHtml('[click](https://example.com)');
    assert.match(html, /href="https:\/\/example\.com\?utm_source=newsletter"/);
  });

  test('should_render_unordered_list', () => {
    const html = markdownToBeehiivHtml('- item 1\n- item 2');
    assert.match(html, /<ul[^>]+>/);
    assert.match(html, /<li[^>]+>item 1<\/li>/);
  });

  test('should_render_ordered_list', () => {
    const html = markdownToBeehiivHtml('1. first\n2. second');
    assert.match(html, /<ol[^>]+>/);
    assert.match(html, /<li[^>]+>first<\/li>/);
  });

  test('should_preserve_real_minus_sign', () => {
    const html = markdownToBeehiivHtml('EPA: −0.12');
    assert.match(html, /−0\.12/);
  });

  test('should_escape_html_entities', () => {
    const html = markdownToBeehiivHtml('A & B < C');
    assert.match(html, /A &amp; B &lt; C/);
  });
});
