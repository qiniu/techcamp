# 从类型系统理解 XGo 编译器的实现

编程语言的类型系统可以分为编译时类型系统（程序编译阶段进行静态类型检查的机制）和运行时类型系统（程序执行期间动态管理类型信息的机制）。
从类型系统角度来看，XGo 兼容 Go 编译时类型系统，LLGo 兼容 C 运行时类型系统，iXGo 兼容 Go 运行时类型系统。

- 七叶 GitHub 个人主页：[https://github.com/visualfc](https://github.com/visualfc)

XGo 语言类型系统设计与 Go 语言类似，融合了静态类型系统，强类型和部分动态类型的特性。
相比 Go 语言，XGo 实现了更加灵活的表达式类型推导机制，并通过 Classfile 和 领域文本功能 来简化使用。

XGo 编译器从宏观上可分为两层，一层是 XGo 语言的编译器，负责 XGo 源码到 Go 源码的转换；
一层是 Go 语言的编译器，负责 Go 源码的编译，可以使用 Go 语言官方编译器，LLGo 编译器，TinyGo 编译器，iXGo 解释器。

本文重点关注的是 XGo 语言编译器，从编译时类型系统角度来理解 XGo 编译器的实现。

### XGo 语言编译器执行流程

[https://github.com/goplus/xgo](https://github.com/goplus/xgo)

XGo 语言编译器的作用是将 XGo 源代码转换为 Go 源代码，但非单纯的源码直接转换方式实现，
而是通过 AST （抽象语法树）转换实现，即 `XGo 源码 => XGo AST => Go AST => Go 源码` 的方式实现。

- XGo 源码 => XGo AST 转换

XGo 编译器通过 Scanner（词法分析）和 Parser (语法分析) 将 XGo 源码转换为 XGo AST。

Scanner（词法分析器）是编译器的第一个阶段，负责将 XGo 源码字符流转换为有意义的词法单元（Token）序列，供后续的语法分析器（Parser）使用。

Parser（语法分析器）是编译器的第二个阶段，负责将 Token 序列转换为 AST（抽象语法树），检查代码结构是否符合语法规则，并报告语法错误。

- XGo AST => Go AST => Go 源码 转换

通过语法分析得到的 XGo AST 只是保证了语法规则正确，还需要检查语义是否正确。这个阶段将 XGo AST 转换为 Go AST，同时对 XGo AST 的类型进行静态类型检查，对表达式进行类型推导，并报告语义错误。

XGo 项目将 Go AST 的生成作为一个独立的项目实现，[https://github.com/goplus/gogen](https://github.com/goplus/gogen) ，`gogen` 同时还负责静态类型检查，提供了对 Go AST 的类型推断、类型检查、函数匹配、接口实现验证等功能。
XGo 编译器通过 `gogen` 将 XGo AST 转换为 Go AST，同时检查语义是否正确，并报告语义错误。
最终由 `gogen` 将 Go AST 转换为 Go 源码输出。

### XGo 编译器类型系统

XGo 源码能够转换为 Go 源码，本质原因在于 XGo 的类型系统与 Go 类型系统完全兼容，这样将 XGo AST 转换为 Go AST 时，语义能够保持一致性。
也正是由于类型完全兼容，所以 Go 源码也能够转换为 XGo 样式的源码，语义保持不变。

- XGo 类型系统

XGo 语言的基础类型和复合类型与 Go 语言保持一致

基础类型：
```
bool
int int8 int16 int32 int64
uint uint8 uint16 uint32 uint64 uintptr
float32 float64
complex64 complex128
unsafe.Pointer
```
复合类型：
```
array chan func interface map pointer slice string struct
```

XGo 内置的大数支持类型在底层上与 Go 数据类型兼容
```
XGo        Go
int128  => struct{ hi int64; lo int64}
uint128 => struct{ hi uint64; lo uint64}
bigint  => big.Int
bigrat  => big.Rat
```

XGo 的 Classfile 文件系统底层实现与 Go 结构体兼容
```
// Point.gox
var (
	x int
	y int
)
```
等价于
```
// point.go
type Point struct {
	x int
	y int
}
```

### XGo 编译器类型检查和类型推导

XGo 编译器在将 XGo AST 转换为 Go AST 过程中通过 `gogen` 对 AST 节点进行类型标记和类型检查，确定语义正确性，对函数参数进行匹配，判断接口断言等是否正确，如果出现错误则给出语义错误信息。

XGo 相比 Go 具有更加灵活的表达式类型推导能力，通过静态类型推导，可以将 List/Map 表达式或者 Lambda 表达式推导出实际类型以便与 Go 类型系统兼容。

- List Literals（列表字面量）

通过 List 中的常量表达式推导 List 类型

`[1, 2, 3, 4]` => `[]int{1, 2, 3, 4}`

`[1, "XGo"]` => `[]any{1, "XGo"}`

也可通过 List 中的变量类型推导 List 类型

```
var i int
echo type([i])
// Output: []int
```

- Map Literals（映射字面量）

通过 Map 中的常量表达式推导 Map 类型

`{1: "XGo", 2: "LLGo"}` => `map[int]string{1: "XGo", 2: "LLGo"}`

`{1: "XGo", 2: 1.2}` => `map[int]any{1: "XGo", 2: 1.2}`

也可通过 Map 中的变量类型推导 Map 类型

```
var k int; 
var m string; 
echo type({k:m})
// Output: map[int]string
``` 

- List Comprehension (列表推导)

通过把循环语句和条件判断等操作融合在一行代码内，快速生成符合特定条件的 List 元素，并推导 List 类型

```
odds := [x for x in 1:10:2]
echo odds, type(odds)
// Output: [1 3 5 7 9] []int
```

- Map Comprehension (映射推导)

通过把循环语句和条件判断等操作融合在一行代码内，快速生成符合特定条件的 Map 元素，并推导 Map 类型。

```
x := {x: i for i, x <- [1, 3, 5, 7, 11]}
echo x, type(x)
// Output: map[1:0 3:1 5:2 7:3 11:4] map[int]int
```

- Lambda Expressions（匿名函数表达式）

在 XGo 中 Lambda 表达式的使用能够简化代码，XGo 编译器根据函数原始定义来推导 Lambda 表达式中的类型。

对于下面这个例子中 `transform([1, 2, 3], x => x*x)` 根据 transform 函数定义进行推导，可推导出 `[1, 2, 3]` 类型为 `[]float64`，推导出 `x` 的类型为 float64，这样这行代码将转换为 Go 语言的 `transform([]float64{1, 2, 3}, func(x float64) float64 { return x*x })`。

```
func transform(a []float64, f func(float64) float64) []float64 {
    return [f(x) for x in a]
}

echo transform([1, 2, 3], x => x*x)
// Output: [1 4 9]

echo transform([-3, 1, -5], x => {
    if x < 0 {
        return -x
    }
    return x
})
// Output: [3 1 5]
```

如果将 XGo 的 Lambda 表达式与 Go 语言的泛型函数组合可以实现更强的语法表达能力。（_注：XGo 本身不支持泛型定义，但可以引用 Go 语言泛型定义。_）

下面这个例子中 `transform[T]` 是由 `transform.go` 定义的一个泛型函数， `main.xgo` 中的 `transform([1, 2, 3], x => x*x)` 语句是在泛型函数中使用 Lambda 表达式， 由于 `transform[T]` 没有参数实例化，无法确定泛型参数 `T` 的类型，所以这里会对 `transform` 函数和参数产生多轮推导，在第一轮推导中，首先推导第一个参数 `[1, 2, 3]` 的类型为 `[]int`，忽略第二个参数 lambda 表达式类型，之后依据`transform[T]`函数的第一个参数为 `[]int` 对泛型函数 `transform[T]`的泛型参数类型进行推断，推断 `T` 的类型为 `int`，之后可以对 `transform[T]` 进行实例化为 `transform[int]`。实例化后进行第二轮推导，在本轮中根据 `transform[int]` 的第二个参数类型 `func(int) int` 可推断 lambda 表达式 `x => x*x` 中的 `x` 类型为 `int`。最终这行代码被转换为 Go 语言的 `transform[int]([]int{1, 2, 3}, func(x int) int { return x*x })`。

```
-- transform.go --
package main

func transform[T any](a []T, f func(T) T) ([]T) {
	out := make([]T, len(a))
	for i, x := range a {
		out[i] = f(x)
	}
	return out
}

-- main.xgo --

echo transform([1, 2, 3], x => x*x)
// Output: [1 4 9]

echo transform([-3, 1, -5], x => {
    if x < 0 {
        return -x
    }
    return x
})
// Output: [3 1 5]
```

类似上面这种带有多个参数的复杂函数进行调用时可能会进行多轮推断，如对于泛型函数的参数需要进行参数推断和实例化处理。
而对于 XGo 支持的重载函数的选择需要根据参数个数和参数类型进行类型匹配和类型推导，同样需要进行多轮推断以选择出正确的重载函数，或者是由于匹配失败给出语义错误信息。

表达式类型推导的最终目的是将 XGo 支持的表达式推导出正确的类型以能够明确的转换为对应的 Go 源码。

### 总结
本文从类型系统的角度出发，简要分析了 XGo 编译器的执行流程、类型系统设计及其类型检查和推导机制。
XGo 通过其精心设计的编译时类型系统和表达式类型推导机制，不仅确保了与 Go 类型系统的完全兼容性，
还保障了从 XGo AST 到 Go AST 转换过程中语义的准确无误。
同时，其类型推导机制在保持类型安全的前提下，简化了语法，提升了开发效率。

如果你对 XGo 的类型系统实现细节感兴趣，欢迎深入查阅其源码仓库 [https://github.com/goplus/xgo](https://github.com/goplus/xgo)，探索更多技术细节。
对于类型系统的设计权衡，你认为在静态类型和动态类型之间，是否存在一种更优的融合方式？
在性能与表达力之间，XGo 的类型系统还有哪些可以优化的空间？
我们期待你的留言和探讨，共同推动编程语言技术的发展。
