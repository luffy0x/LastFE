import { Button } from "@/components/Button";

export default function SubmittedPage() {
  return (
    <main
      id="main-content"
      className="submission-page site-container"
      aria-labelledby="submitted-title"
    >
      <div className="submission-complete">
        <h1 id="submitted-title">投稿已进入审核队列</h1>
        <p>
          内容不会立即公开。维护者会检查隐私、安全性与内容质量，通过后才会出现在对应分类。
        </p>
        <div className="submission-complete__actions">
          <Button href="/">返回首页</Button>
          <Button href="/submit" variant="secondary">
            继续投稿
          </Button>
        </div>
      </div>
    </main>
  );
}
