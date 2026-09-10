import { Button } from "@/components/Button";

export function SubmissionGuide() {
  return (
    <section
      className="submission-guide"
      aria-labelledby="submission-guide-title"
    >
      <h2 id="submission-guide-title">投稿经审核后公开</h2>
      <p>
        任何人都可以投稿，无需注册。内容会先进入审核队列，由维护者检查隐私、安全性与质量后才会公开；未通过审核的内容不会出现在任何页面或搜索结果中。
      </p>
      <p>
        投稿不要求邮箱、手机号或真实姓名，昵称完全可选。请在提交前移除姓名、联系方式、内部链接等不应公开的信息。
      </p>
      <div className="submission-guide__actions">
        <Button href="/submit" size="large">
          开始投稿
        </Button>
      </div>
    </section>
  );
}
