# Computer Use API

## Overview

Computer Use is a beta feature that allows Claude to interact with computers like a human would - by looking at screenshots and controlling the mouse and keyboard. This enables automation of desktop applications, web browsers, and any visual interface.

## How It Works

Unlike FSB's DOM-based approach, Computer Use operates through a visual feedback loop:

```
+-------------+     Screenshot      +-------------+
|             | ------------------> |             |
|   Desktop   |                     |   Claude    |
|  Environment|                     |   (Vision)  |
|             | <------------------ |             |
+-------------+     Actions         +-------------+
      ^                                    |
      |                                    |
      +------------------------------------+
           Mouse/Keyboard Commands
```

### Agent Loop Architecture

1. **Screenshot Capture**: System takes screenshot of current display
2. **Vision Analysis**: Claude analyzes the screenshot to understand UI state
3. **Action Decision**: Claude determines the next action to take
4. **Action Execution**: System executes mouse/keyboard commands
5. **Repeat**: Loop continues until task is complete

```python
# Simplified agent loop
async def computer_use_loop(task: str):
    messages = [{"role": "user", "content": task}]

    while True:
        # Get Claude's response
        response = await anthropic.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            tools=[computer_tool],
            messages=messages
        )

        # Check for completion
        if response.stop_reason == "end_turn":
            return extract_result(response)

        # Process tool calls
        for block in response.content:
            if block.type == "tool_use":
                # Execute the action
                result = await execute_action(block.input)

                # Add result to conversation
                messages.append({
                    "role": "assistant",
                    "content": response.content
                })
                messages.append({
                    "role": "user",
                    "content": [{
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result
                    }]
                })
```

## Model Compatibility

Computer Use requires vision-capable Claude models:

| Model | Computer Use Support | Recommended Use |
|-------|---------------------|-----------------|
| claude-sonnet-4-20250514 | Yes | Production use |
| claude-opus-4-20250514 | Yes | Complex tasks |

## Tool Definitions

### Computer Tool

The main tool for desktop interaction:

```json
{
  "type": "computer_20241022",
  "name": "computer",
  "display_width_px": 1920,
  "display_height_px": 1080,
  "display_number": 0
}
```

### Available Actions

#### Mouse Actions

```json
// Click
{
  "action": "mouse_move",
  "coordinate": [500, 300]
}

// Left click
{
  "action": "left_click"
}

// Right click
{
  "action": "right_click"
}

// Double click
{
  "action": "double_click"
}

// Middle click
{
  "action": "middle_click"
}

// Click and drag
{
  "action": "left_click_drag",
  "start_coordinate": [100, 100],
  "end_coordinate": [200, 200]
}
```

#### Keyboard Actions

```json
// Type text
{
  "action": "type",
  "text": "Hello, World!"
}

// Press key
{
  "action": "key",
  "key": "Return"
}

// Key combination
{
  "action": "key",
  "key": "ctrl+c"
}
```

#### Screen Actions

```json
// Take screenshot
{
  "action": "screenshot"
}

// Scroll
{
  "action": "scroll",
  "coordinate": [500, 300],
  "direction": "down",
  "amount": 3
}
```

### Text Editor Tool

For file editing capabilities:

```json
{
  "type": "text_editor_20241022",
  "name": "str_replace_editor"
}
```

Commands:
- `view`: Read file contents
- `create`: Create new file
- `str_replace`: Replace text in file
- `insert`: Insert text at line
- `undo_edit`: Undo last edit

### Bash Tool

For command execution:

```json
{
  "type": "bash_20241022",
  "name": "bash"
}
```

## Implementation Example

### Python with Anthropic SDK

```python
import anthropic
import base64
from PIL import ImageGrab
import pyautogui

client = anthropic.Anthropic()

# Define tools
tools = [
    {
        "type": "computer_20241022",
        "name": "computer",
        "display_width_px": 1920,
        "display_height_px": 1080,
        "display_number": 0
    }
]

async def capture_screenshot():
    """Capture and encode screenshot"""
    screenshot = ImageGrab.grab()
    buffer = io.BytesIO()
    screenshot.save(buffer, format='PNG')
    return base64.b64encode(buffer.getvalue()).decode()

async def execute_action(action: dict):
    """Execute a computer action"""
    action_type = action.get("action")

    if action_type == "screenshot":
        image_data = await capture_screenshot()
        return {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/png",
                "data": image_data
            }
        }

    elif action_type == "mouse_move":
        x, y = action["coordinate"]
        pyautogui.moveTo(x, y)
        return {"success": True}

    elif action_type == "left_click":
        pyautogui.click()
        return {"success": True}

    elif action_type == "type":
        pyautogui.typewrite(action["text"], interval=0.05)
        return {"success": True}

    elif action_type == "key":
        pyautogui.hotkey(*action["key"].split("+"))
        return {"success": True}

    elif action_type == "scroll":
        x, y = action["coordinate"]
        direction = action["direction"]
        amount = action.get("amount", 3)
        pyautogui.moveTo(x, y)
        scroll_amount = amount if direction == "up" else -amount
        pyautogui.scroll(scroll_amount)
        return {"success": True}

async def run_task(task: str):
    """Run a computer use task"""
    # Start with initial screenshot
    screenshot = await capture_screenshot()

    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": task},
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/png",
                        "data": screenshot
                    }
                }
            ]
        }
    ]

    while True:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            tools=tools,
            messages=messages
        )

        # Check if done
        if response.stop_reason == "end_turn":
            return extract_text_response(response)

        # Process tool uses
        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                result = await execute_action(block.input)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": [result] if isinstance(result, dict) and result.get("type") == "image" else str(result)
                })

        # Add to conversation
        messages.append({"role": "assistant", "content": response.content})
        messages.append({"role": "user", "content": tool_results})
```

## Coordinate Handling

### Resolution Scaling

When working with different display resolutions:

```python
# Model trained on specific resolutions
SUPPORTED_RESOLUTIONS = [
    (1024, 768),   # XGA
    (1280, 800),   # WXGA
    (1920, 1080),  # Full HD
    (2560, 1440),  # QHD
]

def scale_coordinates(x: int, y: int,
                     from_res: tuple, to_res: tuple) -> tuple:
    """Scale coordinates between resolutions"""
    scale_x = to_res[0] / from_res[0]
    scale_y = to_res[1] / from_res[1]
    return (int(x * scale_x), int(y * scale_y))
```

### Coordinate Precision

- Coordinates are in pixels from top-left (0, 0)
- Always verify coordinates are within display bounds
- Consider DPI scaling on high-resolution displays

## Best Practices

### 1. Screenshot Optimization

```python
def optimize_screenshot(image):
    """Optimize screenshot for API"""
    # Resize if too large
    max_dimension = 1568
    if image.width > max_dimension or image.height > max_dimension:
        ratio = min(max_dimension/image.width, max_dimension/image.height)
        new_size = (int(image.width * ratio), int(image.height * ratio))
        image = image.resize(new_size, Image.LANCZOS)

    # Convert to RGB if necessary
    if image.mode in ('RGBA', 'P'):
        image = image.convert('RGB')

    return image
```

### 2. Action Delays

```python
# Add delays between actions
ACTION_DELAYS = {
    "left_click": 0.5,      # Wait for UI response
    "type": 0.1,            # Per character
    "key": 0.3,             # Key press
    "mouse_move": 0.1,      # Movement
    "screenshot": 0.2,      # Capture delay
}

async def execute_with_delay(action: dict):
    result = await execute_action(action)
    delay = ACTION_DELAYS.get(action["action"], 0.2)
    await asyncio.sleep(delay)
    return result
```

### 3. Error Recovery

```python
async def robust_execution(action: dict, max_retries: int = 3):
    """Execute action with retry logic"""
    for attempt in range(max_retries):
        try:
            result = await execute_action(action)
            return result
        except Exception as e:
            if attempt == max_retries - 1:
                raise
            # Take new screenshot and retry
            await asyncio.sleep(1)
            continue
```

### 4. Prompting Tips

```python
SYSTEM_PROMPT = """You are a computer use agent. Follow these guidelines:

1. Always take a screenshot first to understand the current state
2. Move the mouse before clicking to ensure accuracy
3. Wait for UI elements to load after actions
4. Verify action success by taking another screenshot
5. If an action fails, try an alternative approach
6. Report any errors or unexpected states

For text input:
- Click on the input field first
- Wait briefly before typing
- Use Tab to move between fields

For navigation:
- Look for and click navigation elements
- Wait for page loads to complete
- Verify you're on the expected page
"""
```

## Security Considerations

### Risks

1. **Credential Exposure**: Screenshots may capture passwords
2. **Unintended Actions**: Misclicks can cause damage
3. **Prompt Injection**: Malicious content on screen
4. **Data Leakage**: Sensitive information in screenshots

### Mitigations

```python
# Mask sensitive regions before sending
def mask_sensitive_regions(image, regions: list):
    """Mask sensitive screen regions"""
    draw = ImageDraw.Draw(image)
    for region in regions:
        draw.rectangle(region, fill='black')
    return image

# Limit allowed actions
ALLOWED_ACTIONS = ["screenshot", "mouse_move", "left_click", "type"]

def validate_action(action: dict) -> bool:
    """Validate action is allowed"""
    return action.get("action") in ALLOWED_ACTIONS

# Sandbox execution
# Run in isolated VM or container
```

### Recommended Setup

- Use in sandboxed environment (VM, container)
- Limit network access
- Monitor all actions
- Require confirmation for sensitive operations
- Avoid running as administrator/root

## Comparison with DOM-Based Approach (FSB)

| Aspect | Computer Use | DOM-Based (FSB) |
|--------|--------------|-----------------|
| Works with any app | Yes | Web only |
| Speed | Slower (vision) | Faster |
| Accuracy | ~85% | ~90%+ |
| Hidden elements | Cannot see | Can access |
| Visual changes | Sees all | May miss |
| API costs | Higher (images) | Lower |
| Debugging | Screenshot history | DOM logs |

### When to Use Each

**Computer Use:**
- Desktop applications
- Complex visual UIs
- When DOM is inaccessible
- Cross-application workflows

**DOM-Based (FSB):**
- Web automation
- Form filling
- Data extraction
- Speed-critical tasks

## Token/Cost Considerations

| Action | Approximate Tokens |
|--------|-------------------|
| Screenshot (1080p) | ~1,500 tokens |
| Screenshot (4K) | ~6,000 tokens |
| Text response | ~100-500 tokens |
| Full loop iteration | ~2,000-8,000 tokens |

### Cost Optimization

```python
# Reduce screenshot frequency
async def optimized_loop(task: str):
    # Only screenshot when needed
    last_screenshot_time = 0
    MIN_SCREENSHOT_INTERVAL = 2.0  # seconds

    # ... loop logic ...

    if action == "screenshot":
        now = time.time()
        if now - last_screenshot_time < MIN_SCREENSHOT_INTERVAL:
            # Skip unnecessary screenshot
            continue
        last_screenshot_time = now
```

---

*References:*
- [Computer Use Documentation](https://docs.anthropic.com/en/docs/build-with-claude/computer-use)
- [Computer Use Demo](https://github.com/anthropics/anthropic-quickstarts/tree/main/computer-use-demo)
- [Anthropic Cookbook - Computer Use](https://github.com/anthropics/anthropic-cookbook/tree/main/computer_use)
