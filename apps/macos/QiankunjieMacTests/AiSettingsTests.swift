import Foundation
import QiankunjieCore
import Testing
@testable import QiankunjieMac

struct AiSettingsTests {
    @Test func 设置工具按固定顺序提供AI模型入口() {
        #expect(SettingsTool.allCases == [.aiModel, .myMCP, .categories, .resetPassword])
        #expect(SettingsTool.aiModel.title == "AI 模型")
        #expect(SettingsTool.aiModel.systemImage == "sparkles")
    }

    @Test func 解码用户AI设置响应且不包含明文Key字段() throws {
        let data = Data(
            #"""
            {
              "settings": {
                "provider": "deepseek",
                "model": "deepseek-chat",
                "baseUrl": "https://api.example.com/v1",
                "apiKeyConfigured": true,
                "apiKeyLast4": "abcd",
                "apiKeyUpdatedAt": "2026-10-08T08:30:00.000Z",
                "autoTriggerOnArchive": true,
                "updatedAt": "2026-10-08T08:30:00.000Z"
              }
            }
            """#.utf8
        )

        let response = try JSONDecoder.qiankunjie.decode(
            UserAiSettingsResponse.self,
            from: data
        )
        let settings = try #require(response.settings)

        #expect(settings.provider == "deepseek")
        #expect(settings.model == "deepseek-chat")
        #expect(settings.baseUrl == "https://api.example.com/v1")
        #expect(settings.apiKeyConfigured)
        #expect(settings.apiKeyLast4 == "abcd")
        #expect(settings.autoTriggerOnArchive)
    }

    @Test func 解码模型发现连通性测试和AI任务响应() throws {
        let models = try JSONDecoder.qiankunjie.decode(
            DiscoverAiModelsResponse.self,
            from: Data(
                #"{"models":[{"id":"deepseek-chat","name":"DeepSeek Chat"}],"cached":true}"#.utf8
            )
        )
        let test = try JSONDecoder.qiankunjie.decode(
            AiSettingsTestResponse.self,
            from: Data(#"{"ok":true,"latencyMs":860}"#.utf8)
        )
        let jobs = try JSONDecoder.qiankunjie.decode(
            AiJobsResponse.self,
            from: Data(
                #"""
                {
                  "jobs": [{
                    "id": 8,
                    "articleId": 42,
                    "status": "failed",
                    "errorCode": "AI_TIMEOUT",
                    "errorMessage": "模型响应超时",
                    "model": "deepseek-chat",
                    "totalTokens": 128,
                    "createdAt": "2026-10-08T08:30:00.000Z",
                    "finishedAt": null
                  }],
                  "total": 8,
                  "usage": {
                    "totalJobs": 8,
                    "succeededJobs": 6,
                    "failedJobs": 2,
                    "totalTokens": 4096
                  }
                }
                """#.utf8
            )
        )
        let job = try #require(jobs.jobs.first)

        #expect(models.models.first?.id == "deepseek-chat")
        #expect(models.cached)
        #expect(test.latencyMs == 860)
        #expect(jobs.usage.totalJobs == 8)
        #expect(jobs.usage.succeededJobs == 6)
        #expect(jobs.usage.failedJobs == 2)
        #expect(jobs.usage.totalTokens == 4096)
        #expect(job.articleId == 42)
        #expect(job.errorCode == "AI_TIMEOUT")
        #expect(job.errorMessage == "模型响应超时")
        #expect(job.totalTokens == 128)
    }

    @Test func 解码文章列表和详情的AI状态字段() throws {
        let json = """
        {
          "id": 42,
          "aiStatus": "failed",
          "aiErrorCode": "AI_TIMEOUT",
          "aiErrorMessage": "模型响应超时",
          "aiModel": "deepseek-chat",
          "aiTotalTokens": 128
        }
        """
        let data = Data(json.utf8)

        let card = try JSONDecoder.qiankunjie.decode(ArticleCard.self, from: data)
        let detail = try JSONDecoder.qiankunjie.decode(ArticleDetail.self, from: data)

        #expect(card.aiStatus == "failed")
        #expect(card.aiErrorCode == "AI_TIMEOUT")
        #expect(card.aiErrorMessage == "模型响应超时")
        #expect(card.aiModel == "deepseek-chat")
        #expect(card.aiTotalTokens == 128)
        #expect(detail.aiStatus == "failed")
        #expect(detail.aiModel == "deepseek-chat")
    }

    @Test func AI状态展示完整七种中文文案() {
        let expected: [(String, String)] = [
            ("not_generated", "未生成"),
            ("disabled", "自动生成已关闭"),
            ("not_configured", "未配置模型"),
            ("queued", "AI 排队中"),
            ("running", "AI 生成中"),
            ("succeeded", "AI 已完成"),
            ("failed", "AI 失败"),
        ]

        for (status, text) in expected {
            #expect(aiStatusText(status) == text)
        }
        #expect(aiStatusText(nil) == "未生成")
        #expect(aiStatusText("unknown") == "未生成")
    }

    @Test func 删除配置使用明确的二次确认文案() {
        #expect(AiSettingsView.deleteConfirmationTitle == "确定删除 AI 配置？")
        #expect(
            AiSettingsView.deleteConfirmationMessage
                == "删除后归档将不再自动生成 AI 摘要。"
        )
    }
}
