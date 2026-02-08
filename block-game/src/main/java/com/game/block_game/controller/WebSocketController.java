package com.game.block_game.controller;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

import com.game.block_game.model.Block;
import com.game.block_game.repo.BlockRepository;

@Controller
public class WebSocketController {

    private final BlockRepository repo;

    public WebSocketController(BlockRepository repo) {
        this.repo = repo;
    }

    // FRONTEND sends → /app/claim
    // BACKEND broadcasts → /topic/updates
    @MessageMapping("/claim")
    @SendTo("/topic/updates")
    public Block claimBlock(Block block) {

        Block dbBlock = repo.findById(block.getId())
                .orElseThrow(() -> new RuntimeException("Block not found"));

        dbBlock.setOwner(block.getOwner());
        dbBlock.setColor(block.getColor());

        repo.save(dbBlock);

        return dbBlock;   // send updated block to all clients
    }
}
