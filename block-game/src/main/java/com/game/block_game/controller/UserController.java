package com.game.block_game.controller;

import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = "http://localhost:3000")
public class UserController {

    private static final List<String> COLORS =
        Arrays.asList("#6C63FF","#4CAF50","#2196F3","#FF5252","#FFB300","#00BCD4");

    private static int colorIndex = 0;

    @PostMapping("/register")
    public Map<String, String> registerUser() {
        String userId = "User-" + new Random().nextInt(900);

        String color = COLORS.get(colorIndex % COLORS.size());
        colorIndex++;

        Map<String,String> user = new HashMap<>();
        user.put("id", userId);
        user.put("color", color);

        return user;
    }
}
