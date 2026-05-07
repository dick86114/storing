# GitHub Actions Workflows 使用说明

本项目包含两个主要的GitHub Actions workflow：

1. **CI Workflow** - 代码质量检查和构建测试
2. **Docker Workflow** - Docker镜像构建和推送

---

## CI Workflow

### 功能说明

CI workflow会在每次代码推送或Pull Request时自动运行，确保代码质量：

1. **Lint检查** - 代码风格检查
2. **Type Check** - TypeScript类型检查
3. **Build** - 项目构建测试
4. **Security Check** - 安全漏洞检查
5. **Dependency Review** - 依赖审查（PR时）

### 触发条件

- 推送到 `main`, `master`, `develop` 分支
- Pull Request到 `main`, `master`, `develop` 分支
- 手动触发

### Jobs说明

#### 1. Lint Job
- 运行代码风格检查
- 使用项目配置的lint规则

#### 2. Type Check Job
- 检查API、Web、Shared三个包的TypeScript类型
- 确保类型安全

#### 3. Build Job
- 构建整个项目
- 上传构建产物（保留7天）
- 验证构建是否成功

#### 4. Test Job
- 仅在Pull Request时运行
- 运行测试脚本（如果存在）

#### 5. Security Check Job
- 运行安全审计
- 检查依赖漏洞
- 检查过时的依赖

#### 6. Dependency Review Job
- 仅在Pull Request时运行
- 审查依赖变更
- 检查许可证合规性

### 查看CI结果

1. 进入仓库的 **Actions** 页面
2. 选择对应的workflow运行记录
3. 查看各个job的执行结果

---

## Docker Workflow

## 功能说明

这个workflow会自动构建Docker镜像并上传到DockerHub，支持以下触发方式：

1. **推送到main/master分支** - 自动构建并推送latest标签
2. **创建版本标签** - 自动构建并推送版本标签（如v1.0.0）
3. **Pull Request** - 仅构建测试，不推送镜像
4. **手动触发** - 可以在GitHub Actions页面手动触发

## 配置步骤

### 1. 在DockerHub创建仓库

首先需要在DockerHub上创建一个仓库来存储镜像：

1. 登录 [DockerHub](https://hub.docker.com/)
2. 点击 "Create Repository"
3. 仓库名设置为：`storing`（或你喜欢的名称）
4. 设置为公开或私有（根据需求）

### 2. 配置GitHub Secrets

在GitHub仓库中配置以下Secrets：

1. 进入仓库的 **Settings** → **Secrets and variables** → **Actions**
2. 点击 **New repository secret** 添加以下两个secret：

   **DOCKERHUB_USERNAME**
   - 你的DockerHub用户名
   
   **DOCKERHUB_TOKEN**
   - DockerHub的访问令牌（不是密码）
   - 在DockerHub的 Account Settings → Security → Access Tokens 创建

### 3. 修改workflow配置

如果需要修改镜像名称，编辑 `.github/workflows/docker.yml` 文件：

```yaml
env:
  DOCKER_IMAGE: storing  # 修改为你的镜像名称
```

## 镜像标签说明

构建完成后，镜像会有以下标签：

- **latest** - main/master分支的最新版本
- **分支名** - 如 `main`, `master`
- **版本号** - 如 `v1.0.0`, `v1.0`, `v1`（当创建git tag时）
- **PR编号** - 如 `pr-123`（Pull Request时，仅构建不推送）

## 使用示例

### 拉取镜像

```bash
# 拉取最新版本
docker pull your-username/storing:latest

# 拉取特定版本
docker pull your-username/storing:v1.0.0

# 拉取特定分支
docker pull your-username/storing:main
```

### 运行容器

```bash
docker run -d \
  --name storing \
  -p 1050:1050 \
  -p 1052:1052 \
  --env-file .env \
  your-username/storing:latest
```

## Workflow特性

### ✅ 多平台支持
- 支持 `linux/amd64` 和 `linux/arm64` 架构
- 可以在不同平台运行

### ✅ 缓存优化
- 使用GitHub Actions缓存加速构建
- 减少重复构建时间

### ✅ 自动测试
- Pull Request时自动测试构建的镜像
- 验证服务是否正常启动

### ✅ 自动更新描述
- 推送到main分支时自动更新DockerHub仓库描述
- 使用DOCKER.md文件内容

## 手动触发

### 使用手动触发功能

在GitHub仓库页面：

1. 点击 **Actions** 标签
2. 选择 **Docker Build and Push** workflow
3. 点击 **Run workflow**
4. 配置以下参数：

   **是否推送镜像到DockerHub**
   - 默认：是
   - 如果选择"否"，则只构建镜像不推送（用于测试）
   
   **自定义镜像标签**
   - 可选参数
   - 不填则自动生成标签（如分支名、latest等）
   - 填写后会使用自定义标签（如 `test-v1.0`）
   
   **构建平台**
   - 默认：`linux/amd64,linux/arm64`（多平台）
   - 可选择：
     - `linux/amd64,linux/arm64` - 多平台构建
     - `linux/amd64` - 仅AMD64架构
     - `linux/arm64` - 仅ARM64架构
   
   **构建分支**
   - 默认：`main`
   - 可选择：`main`, `master`, `develop`
   - 用于指定要构建的分支

5. 点击 **Run workflow** 开始构建

### 手动触发使用场景

1. **测试构建** - 选择"不推送镜像"，仅测试构建是否成功
2. **特定平台构建** - 只需要特定架构的镜像时
3. **自定义标签** - 创建测试版本或特殊版本时
4. **构建其他分支** - 测试develop分支或其他分支的构建

## 注意事项

1. **确保Dockerfile正确** - workflow使用项目根目录的Dockerfile
2. **配置正确的Secrets** - 否则无法推送到DockerHub
3. **版本标签格式** - 使用 `v` 开头的格式，如 `v1.0.0`
4. **测试环境变量** - PR测试时使用测试环境变量，不会暴露真实配置

## 故障排查

### 构建失败
- 检查Dockerfile语法
- 查看构建日志中的错误信息
- 确保所有依赖文件都存在

### 推送失败
- 检查DockerHub Secrets配置
- 确认DockerHub Token权限
- 验证仓库是否存在

### 测试失败
- 检查容器启动日志
- 确认端口映射正确
- 验证健康检查接口

## 相关文件

- `.github/workflows/docker.yml` - Workflow配置文件
- `Dockerfile` - Docker镜像构建文件
- `DOCKER.md` - DockerHub仓库描述文件
- `docker-compose.yml` - 本地部署配置文件