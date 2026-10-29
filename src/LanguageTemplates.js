export const LANGUAGES = [
  { id: "plaintext", label: "📝 Plain Text", mode: "null"         },
  { id: "javascript", label: "JavaScript",  mode: { name: "javascript", json: false } },
  { id: "python",     label: "Python",      mode: "python"       },
  { id: "java",       label: "Java",        mode: "text/x-java"  },
  { id: "cpp",        label: "C++",         mode: "text/x-c++src"},
  { id: "c",          label: "C",           mode: "text/x-csrc"  },
  { id: "csharp",     label: "C#",          mode: "text/x-csharp"},
  { id: "php",        label: "PHP",         mode: "php"          },
  { id: "ruby",       label: "Ruby",        mode: "ruby"         },
  { id: "go",         label: "Go",          mode: "go"           },
  { id: "rust",       label: "Rust",        mode: "rust"         },
  { id: "typescript", label: "TypeScript",  mode: { name: "javascript", typescript: true } },
  { id: "swift",      label: "Swift",       mode: "swift"        },
  { id: 'fileshare', label: '📁 File Share', mode: 'null' },
];

export const TEMPLATES = {
  plaintext: `Welcome! This is a shared notepad.
Type anything here — notes, ideas, links, or just chat.
Everyone in the room can see what you write in real time.
`,

  javascript: `// JavaScript
function greet(name) {
  console.log(\`Hello, \${name}!\`);
}

greet("World");
`,

  python: `# Python
def greet(name):
  print(f"Hello, {name}!")

greet("World")
`,

  java: `// Java
public class Main {
  public static void main(String[] args) {
    System.out.println("Hello, World!");
  }

  public static String greet(String name) {
    return "Hello, " + name + "!";
  }
}
`,

  cpp: `// C++
#include <iostream>
#include <string>
using namespace std;

string greet(string name) {
  return "Hello, " + name + "!";
}

int main() {
  cout << greet("World") << endl;
  return 0;
}
`,

  c: `// C
#include <stdio.h>

void greet(const char *name) {
  printf("Hello, %s!\\n", name);
}

int main() {
  greet("World");
  return 0;
}
`,

  csharp: `// C#
using System;

class Program {
  static void Main(string[] args) {
    Console.WriteLine(Greet("World"));
  }

  static string Greet(string name) {
    return $"Hello, {name}!";
  }
}
`,

  php: `<?php
// PHP
function greet(string $name): string {
  return "Hello, {$name}!";
}

echo greet("World");
?>
`,

  ruby: `# Ruby
def greet(name)
  puts "Hello, #{name}!"
end

greet("World")
`,

  go: `// Go
package main

import "fmt"

func greet(name string) string {
  return fmt.Sprintf("Hello, %s!", name)
}

func main() {
  fmt.Println(greet("World"))
}
`,

  rust: `// Rust
fn greet(name: &str) -> String {
  format!("Hello, {}!", name)
}

fn main() {
  println!("{}", greet("World"));
}
`,

  typescript: `// TypeScript
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

console.log(greet("World"));
`,

  swift: `// Swift
import Foundation

func greet(_ name: String) -> String {
  return "Hello, \\(name)!"
}

print(greet("World"))
`,
};
