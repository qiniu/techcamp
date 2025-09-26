# LLGo 中 Python 编译与运行时集成：从依赖识别到一键交付

## 前言

LLGo 是一款基于 LLVM 的 Go 编译器，它把 Go 的类型系统和 SSA/IR 构建与 C/C++/Python 生态融合在一起，从“能否编到一起”到“如何舒服地用起来”，中间隔着一整套构建、版本、分发与运行时的工程系统。本文以“LLGo 中与 Python 相关的编译流程”为主线，串联 C/C++ 与 Python 的关键差异与共同点，并结合 `bundle` 能力说明如何把 Python 一起打包，做到“拿来就跑”。

## LLGo 中与 Python 相关的编译流程解析

### 顶层入口：把 Python 能力“接进来”

- 入口函数负责建立 SSA/IR 编译容器，并懒加载运行时与 Python 符号包：
```go
	prog.SetRuntime(func() *types.Package {
		noRt = 0
		return altPkgs[0].Types
	})
	prog.SetPython(func() *types.Package {
		return dedup.Check(llssa.PkgPython).Types
	})
```
- 为什么不需要“C 的提供者”？
  - C/C++ 的函数类型/符号在 cgo 与编译/链接期已给出，不需要像 Python 一样在 SSA 层动态提供类型信息。

### 构建包：识别依赖、归一化链接、标记是否需要 Python 初始化

- 统一遍历待构建的包，按“包类别”决定如何处理：
```go
		switch kind, param := cl.PkgKindOf(pkg.Types); kind {
		case cl.PkgDeclOnly:
			pkg.ExportFile = ""
		case cl.PkgLinkIR, cl.PkgLinkExtern, cl.PkgPyModule:
			// ... 见下文
		default:
			// 常规包
```
- 与 Python 直接相关的两类：
  - 外链库（link: ...）：当参数内出现 `$(pkg-config --libs python3-embed)`，先“准备一套可用的 Python 工具链”，再展开成 `-lpythonX -L...` 等链接参数。
  - Python 模块（py.<module>）：缺失则在“独立 Python 环境”内用 pip 安装，不污染系统。

关键实现（展开 pkg-config 前的“Python 预构建”四步）：
```go
{"prepare Python cache", func() error { return pyenv.EnsureWithFetch("") }},
{"setup Python build env", pyenv.EnsureBuildEnv},
{"verify Python", pyenv.Verify},
{"fix install_name", func() error { return pyenv.FixLibpythonInstallName(pyHome) }},
```
- EnsureWithFetch：下载独立发行版到缓存（standalone，不侵入用户系统）。
- EnsureBuildEnv：注入 PATH、PYTHONHOME、PKG_CONFIG_PATH 等，使 pkg-config 可正确解析头/库路径。
- Verify：快速跑解释器以确认可用。
- FixLibpythonInstallName（macOS）：把 libpython 的 install_name 调整为 @rpath/...，便于后续按 rpath 定位。

### 链接阶段：注入“初始化解释器”，并确保运行时能找到库

- 汇总所有对象文件与链接参数的同时，聚合“是否需要 Python 初始化”标记（使用到 Python C-API 的包会置 true）：
```go
		if p.ExportFile != "" && aPkg != nil {
			// ...
			need1, need2 := isNeedRuntimeOrPyInit(ctx, p)
			if !needRuntime { needRuntime = need1 }
			if !needPyInit   { needPyInit = need2 }
		}
```
- 生成主入口 IR：按需声明并调用 Python 初始化符号（入口早期执行），然后导出为一个 .o 参与最终链接：
```go
	if needPyInit {
		pyEnvInit = "call void @__llgo_py_init_from_exedir()"
		pyEnvInitDecl = "declare void @__llgo_py_init_from_exedir()"
	}
```
- 生成“初始化桥接 .o”（C 源即时编译）：它会从可执行文件相对位置推导 PYTHONHOME，并完成解释器初始化，与入口 IR 的调用对接。
```go
	out := tmp.Name() + ".o"
	args := []string{
		"-x", "c",
		"-o", out, "-c", tmp.Name(),
	}
	// 注入 Python 头文件
	inc := filepath.Join(pyenv.PythonHome(), "include", "python3.12")
	args = append(args, "-I"+inc)
	cmd := ctx.compiler()
	if err := cmd.Compile(args...); err != nil { return "", err }
```
- 注入 rpath：在得到完整 linkArgs 之后再去重追加，既考虑独立 Python 的 lib 路径，也考虑常用的 `@executable_path` 前缀（macOS）：
```go
		for _, dir := range pyenv.FindPythonRpaths(pyenv.PythonHome()) {
			addRpath(&linkArgs, dir)
		}
		addRpath(&linkArgs, "@executable_path/python/lib")
		addRpath(&linkArgs, "@executable_path/lib/python/lib")
```
- 最终链接（统一交给 clang/或交叉链接器），把以上对象与参数合并为可执行文件：
```go
	buildArgs := []string{"-o", app}
	buildArgs = append(buildArgs, linkArgs...)
	// 可选：调试符号/交叉编译 LDFLAGS/EXTRAFLAGS
	buildArgs = append(buildArgs, ctx.crossCompile.LDFLAGS...)
	buildArgs = append(buildArgs, ctx.crossCompile.EXTRAFLAGS...)
	buildArgs = append(buildArgs, objFiles...)
	return cmd.Link(buildArgs...)
```

## 可选打包（Bundle）：让用户“开箱即用”
想让用户机器“无需安装/配置 Python”，可以把 Python 打进发布物里，两种形态：

- dir（目录式）：把 libpython 和标准库复制到可执行文件旁固定层级，并在 macOS 下设置 install_name 为 @rpath：
```go
// <exe_dir>/python/lib/libpython3.x.{dylib|so}
// <exe_dir>/python/lib/python3.12/**（含 lib-dynload/ 与 site-packages/）
func BundleOnedir(app string) error {
	exeDir := filepath.Dir(app)
	pyHome := PythonHome()
	exelibDir := filepath.Join(exeDir, "lib")
	// ...
```
```go
	libSrc, err := findLibpython(filepath.Join(pyHome, "lib"))
	// 复制到 <exe_dir>/lib/python/lib
	if runtime.GOOS == "darwin" {
		_ = exec.Command("install_name_tool", "-id", "@rpath/"+filepath.Base(libDst), libDst).Run()
	}
```
- exe（单文件自解压）：把“Python 目录 + 应用二进制”打成一个可执行壳，首次运行解压到缓存后设置库路径与 PYTHONHOME 再启动应用。
```go
func BuildOnefileBinary(exe string, out string) error {
	payload, err := BuildPyBundleZip()
	// 写入 payload.zip + app.bin + 最小 Go main 启动器
	cmd := exec.Command("go", "build", "-o", out, "main.go")
	// ...
	return nil
}
```

通俗理解：onedir = “把 Python 摆在程序旁”，onefile = “把 Python 藏进单文件里”；两者都不依赖用户系统有没有 Python。

## C/C++ 与 Python：相同框架，不同要点
- 相同：
  - 统一走“构建包 → 导出 .o → 收集 LinkArgs → 链接”的编译框架；
  - 外部库都走 `link: ...` 归一化为 `-L/-l/...`。
- 不同：
  - 运行期需求：C/C++ 无需“启动运行时”；Python 必须初始化解释器（设置 PYTHONHOME + 初始化调用）。
  - 环境准备：C/C++ 通常只要系统已有库即可；Python 需预置独立环境、修改 install_name（macOS）、并在链接期注入 rpath。
  - 额外对象：Python 会生成“初始化桥接 .o”；C/C++ 无需此步。

## 一眼看懂的调用顺序
- Do
- buildAllPkgs（初始包集）
- buildPkg（每包：NewPackageEx → buildCgo/LLGoFiles → exportObject）
- buildAllPkgs（替代包/补丁）
- createGlobals（如有）
- linkMainPkg
  - 收集对象/链接参数 → 生成主入口 .o（含 Python 初始化声明/调用） → 如需再生成 Python 初始化桥接 .o → 追加 rpath → 最终链接
- 运行/测试（按模式）

## 总结

- 识别与分类：通过 link: ... 与 py.<module> 判定 Python 依赖，触发专属流程；C/C++ 仅归一化为 -L/-l 无需额外运行时。

- 预构建环境：在展开 $(pkg-config --libs python3-embed) 前完成 EnsureWithFetch、EnsureBuildEnv、Verify、FixLibpythonInstallName，保证可解析、可链接、可运行且不侵入系统。

- 链接注入：主入口注入 __llgo_py_init_from_exedir 调用并生成桥接 .o，统一追加 rpath（含独立 Python 与 @executable_path/...），再交由链接器合成可执行文件。

- 可选打包：BundleOnedir（目录式）与 BuildOnefileBinary（单文件）让应用“拿来就跑”，无需用户安装/配置 Python。

- 本质差异：C/C++ 无需“启动运行时”；Python 需在启动早期设置 PYTHONHOME 并初始化解释器。

- 结果与价值：实现“可编译、可链接、可运行、可分发、可复现”，以最小侵入把 Python 能力工程化纳入 Go 应用交付链路。



