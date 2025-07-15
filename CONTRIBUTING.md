# Contributing to VerdantView 🌱

Thank you for your interest in contributing to VerdantView! We welcome contributions from the community to help make this extension even better.

## 🚀 Getting Started

### Prerequisites
- Node.js (version 16 or higher)
- npm or yarn
- VS Code
- Git

### Setting Up Development Environment

1. **Fork the repository**
   ```bash
   git clone https://github.com/sitharaj88/VerdantView.git
   cd VerdantView
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development**
   ```bash
   npm run watch
   ```

4. **Launch Extension Development Host**
   - Press `F5` in VS Code
   - This opens a new VS Code window with the extension loaded

## 🛠️ Development Guidelines

### Code Style
- We use TypeScript with strict mode enabled
- Follow the existing code style and conventions
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

### File Structure
```
src/
├── extension.ts          # Main extension entry point
├── gardenProvider.ts     # Tree view provider
├── fileAnalyzer.ts       # File analysis logic
├── gardenStatusBar.ts    # Status bar integration
└── test/                 # Test files
```

### Making Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clean, well-documented code
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**
   ```bash
   npm run test
   npm run compile
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

### Commit Message Format
We follow conventional commits:
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

## 🐛 Reporting Issues

Found a bug? We'd love to hear about it!

1. **Check existing issues** first to avoid duplicates
2. **Use the issue template** when creating new issues
3. **Provide detailed information**:
   - VS Code version
   - Extension version
   - Operating system
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots or error messages

## 💡 Feature Requests

Have an idea for a new feature?

1. **Check the roadmap** and existing issues
2. **Open a discussion** to get feedback from the community
3. **Create a detailed proposal** explaining:
   - The problem you're solving
   - Your proposed solution
   - Alternative approaches considered
   - Impact on existing functionality

## 📝 Documentation

Help improve our documentation:

- **README updates** - Improve clarity and add examples
- **Code comments** - Add or improve inline documentation
- **Wiki pages** - Create tutorials and guides
- **API documentation** - Document public interfaces

## 🧪 Testing

### Running Tests
```bash
npm run test
```

### Adding Tests
- Write unit tests for new functions
- Test edge cases and error conditions
- Ensure good test coverage
- Use descriptive test names

### Manual Testing
1. Test with different file types
2. Verify health indicators work correctly
3. Check grouping and filtering features
4. Test with large codebases
5. Verify performance impact

## 🎨 Design Guidelines

### Icons and Images
- Use SVG format for scalability
- Follow VS Code's design language
- Maintain consistency with existing icons
- Support both light and dark themes

### User Experience
- Keep interactions intuitive
- Provide helpful tooltips and feedback
- Ensure accessibility
- Follow VS Code UX patterns

## 🔧 Building and Packaging

### Development Build
```bash
npm run compile
```

### Production Build
```bash
npm run package
```

### Extension Packaging
```bash
vsce package
```

## 📋 Pull Request Process

1. **Fork and clone** the repository
2. **Create a feature branch** from `main`
3. **Make your changes** following our guidelines
4. **Add tests** for new functionality
5. **Update documentation** as needed
6. **Run the test suite** and ensure all tests pass
7. **Submit a pull request** with:
   - Clear title and description
   - Reference to related issues
   - Screenshots for UI changes
   - Testing instructions

### Pull Request Checklist
- [ ] Tests pass locally
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] No breaking changes (or clearly documented)
- [ ] Commits follow conventional format
- [ ] PR description is clear and complete

## 🏆 Recognition

Contributors who make significant improvements will be:
- Added to the contributors list
- Mentioned in release notes
- Given credit in documentation

## 📞 Getting Help

Need help contributing?

- 💬 [Start a discussion](https://github.com/sitharaj88/VerdantView/discussions)
- 📧 Ask questions in issues
- 📖 Check the documentation

## 🌱 Code of Conduct

This project follows a code of conduct to ensure a welcoming environment:

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Assume good intentions
- Report unacceptable behavior

---

Thank you for helping make VerdantView a better tool for everyone! 🌿✨
