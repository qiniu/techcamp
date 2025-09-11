# 从类型系统理解 LLGo 编译器的实现

编程语言的类型系统可以分为编译时类型系统（程序编译阶段进行静态类型检查的机制）和运行时类型系统（程序执行期间动态管理类型信息的机制）。
LLGo 是基于 LLVM 实现的 Go 语言编译器，从类型系统角度来看，LLGo 的编译时类型系统完全兼容 Go 语言，而 LLGo 的 Go 语言运行时类型系统与 C 语言运行时类型系统保持二进制兼容。

- 七叶 GitHub 个人主页：[https://github.com/visualfc](https://github.com/visualfc)

LLGo 兼容 Go 编译时类型系统，指的是提供给 LLGo 编译的 Go 源码包括 LLGo 的 C/C++ 模块（LLGoPackage）在语法/语义上完全兼容 Go 语言的编译时类型系统，可以使用 Go 官方编译器进行编译，但可能无法链接。

LLGo 的 Go 语言运行时系统提供了与官方 Go 语言运行时系统类似的自动内存管理、并发调度、运行时检查和错误处理等功能，同时通过二进制接口 ABI (Application Binary Interface) 与 C/C++ 保持二进制兼容。通过 LLGo 编译器可以使用 Go 语法优雅地去调用 C 和 Python 库，确保 Go 和 C/C++/Python 之间互操作没有任何障碍，方便融合 C/C++/Python 生态。

LLGo 的编译器从架构设计上可以分为两层，第一层是 Go 语言层，负责将 Go 源码转换为 Go SSA；第二层是 LLVM 层，负责将 Go SSA 转换为 LLVM SSA，根据需要链接为平台对应的二进制可执行文件或动态库/静态库。LLGo 编译器重点实现的是 Go SSA 到 LLVM SSA 的转换。

本文从类型系统角度来理解 LLGo 编译器的实现。

## LLGo 编译器执行流程

[https://github.com/goplus/llgo](https://github.com/goplus/llgo)

LLGo 使用 Go 官方提供的源码分析处理工具集 golang.org/x/tools 来实现 Go 源码到 Go SSA 的转换。
Go 语言的编译过程可以分为多个阶段，从源码到 SSA，主要包括词法分析、语法分析、类型检查、中间代码生成（SSA）。


### Go 源码到 Go AST 的转换

Go 编译器通过 Scanner（词法分析）和 Parser（语法分析）将 Go 源码转换为 Go AST。

1. Scanner（词法分析器）负责将 Go 源码字符流转换为词法单元（Token）序列，供后续的语法分析器（Parser）使用。

2. Parser（语法分析器）负责将 Token 序列转换为 AST（抽象语法树），检查代码结构是否符合语法规则，并报告语法错误。


### Go AST 到 Go SSA 的转换
1. Types Check（类型检查）

类型检查的目的是对 AST 进行类型检查，确保变量、函数和表达式的使用符合类型系统的要求。
类型检查使用 Go 官方提供的 go/types 库实现，从而确保 LLGo 编译的源码类型系统与 Go 语言在语义上完全相同。

2. 从 AST 构建 Go SSA

SSA 的中文名称是静态单赋值（Static Single Assignment）

将 AST 转换为 SSA 形式的过程是编译器的关键步骤之一，主要包括构建控制流图，插入 φ 函数，生成 SSA 形式等。
golang.org/x/tools 是 Go 官方提供的一个工具库，它包含了多种用于分析和处理 Go 源码的工具。其中，go/ssa 包提供了一个用于构建和操作 SSA 形式的库，LLGo 通过使用 go/ssa 包来完成 Go 源码到 Go SSA 的转换。

### Go SSA 到 LLVM SSA 的转换

1. 类型系统映射

LLVM 的 IR 类型系统与 Go 不同，需要将 Go 的类型系统正确映射到 LLVM 的 IR 类型系统中。

基础类型：
```
bool		=> llvm integer type i1
int8/uint8	=> llvm integer type i8
int16/uint16	=> llvm integer type i16
int32/uint32	=> llvm integer type i32
int64/uint64	=> llvm integer type i64
int/uint/uintptr	=> llvm integer type i32/i64
float32	=> llvm float type
float64	=> llvm double type
```
复合类型：
```
complex64/complex128	=> llvm struct type
struct	=> llvm struct type
string	=> llvm struct type
interface	=> llvm struct type
array	=> llvm array type
chan	=> llvm pointer type
map	=> llvm pointer type
pointer	=> llvm pointer type
func	=> llvm function type
closure	=> llvm struct type
```

2. LLGo 的运行时类型系统

Go 的运行时类型系统是其类型安全和动态类型检查的核心机制，在运行时检查和操作类型信息对于接口（interface）
和反射（reflection）的实现至关重要。

运行时类型指的是变量/函数的类型在运行时进行接口检查/操作的类型信息。

```go
type Type struct {
	Size_       uintptr
	PtrBytes    uintptr
	Hash        uint32
	TFlag       TFlag
	Align_      uint8
	FieldAlign_ uint8
	Kind_       uint8   
	Equal       func(unsafe.Pointer, unsafe.Pointer) bool
	GCData      *byte
	Str_        string
	PtrToThis_  *Type
}

ArrayType
ChanType
FuncType
MapType
SliceType
StructType
InterfaceType
PointerType
```

LLGo 的运行时类型系统与官方 Go 实现在语义上完全相同，提供了与 Go 官方一致的运行时接口检查和反射机制，
但运行时 ABI 与 Go 官方不兼容，即运行时类型系统的数据结构和内存布局与 Go 官方不保证兼容性。


3. Go SSA 到 LLVM SSA 的转换

LLVM SSA 转换是 LLGo 编译器的核心功能，通过 llgo 实现的 `github.com/goplus/llgo/ssa` 这个库可以将 Go SSA 转换到 LLVM SSA。
其中每一个 Go Package 都会转换为一个对应 LLVM IR Module。
从这里开始 LLGo 将 Go 源码完全转换到 LLVM 中，对于 LLVM IR Module 可以根据需要使用 LLVM 提供的分析处理机制和工具进行对应操作。

4. LLVM IR Module 链接

根据需要，LLGo 可以将转换后的 LLVM IR Module 链接为平台对应的二进制可执行文件或动态库/静态库。
LLGo 会根据平台不同，提供不同平台对应的链接命令/库文件/函数等，如 WebAssembly 平台会通过 Emscripten 实现，嵌入式比如 esp32 也会提供对应的链接命令/库函数支持等实现。

5. C ABI 跨平台兼容

C 语言的 ABI（Application Binary Interface，应用程序二进制接口）兼容性是保证 LLGo 与 C 语言直接互操作的关键。
C ABI 定义了程序在二进制层面上的接口，包括函数参数调用规则、数据类型表示、内存布局等。
在 Go SSA 到 LLVM SSA 的转换过程中通过数据映射已经保证了数据类型和内存布局的兼容性。
函数参数调用规则 包括 调用约定 和 参数/返回值传递方式。在不同平台（i386 / amd64 / arm64 / wasm ...） 上，
C 语言的参数/返回值传递方式都可能不同，比如 amd64 上对于 结构体/数组 如果大小超过 128bit ，会改为按地址传递，如果大小在 64bit ~ 128bit 之间则可能会拆分为两个参数传递。Go 官方 CGO 的解决方案是将参数/返回值包装为结构体的方式通过指针传递来实现，需要两次转换。
LLGo 则使用类似 LLVM IR pass 的方式实现，在将 Go SSA 生成的 LLVM IR Module 链接到特定平台之前，会依据不同平台的函数参数调用规则对 IR Module 进行转换处理，从而确保 IR Module 能够与对应平台 C 语言调用规则完全兼容。
LLGo 不光是调用 C 语言函数使用 C ABI 方式，对于 Go 语言本身的函数调用规则也遵循了 C ABI，这样 Go 语言无论是调用函数/导出函数/回调函数均可与 C 语言直接交互，即简洁又高效，确保了 LLGo 对 C 语言运行时的完全兼容。

## 总结
本文从类型系统的角度出发，简要分析了 LLGo 编译器的执行流程、类型系统转换，C ABI 兼容性。

LLGo 在编译时与 Go 类型系统完全兼容，而 LLGo 的 Go 语言运行时类型系统与 C 语言运行时类型系统保持二进制兼容。

如果你对 LLGo 的类型系统实现细节感兴趣，欢迎深入查阅其源码仓库 [https://github.com/goplus/llgo](https://github.com/goplus/llgo)，探索更多技术细节。

我们期待你的留言和探讨，共同推动编程语言技术的发展。
