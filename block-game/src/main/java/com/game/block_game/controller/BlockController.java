package com.game.block_game.controller;

import java.util.List;

import org.springframework.web.bind.annotation.*;

import com.game.block_game.model.Block;
import com.game.block_game.repo.BlockRepository;

@RestController
@RequestMapping("/api/blocks")
@CrossOrigin(origins = "http://localhost:3000")
public class BlockController {

    private final BlockRepository repo;

    public BlockController(BlockRepository repo) {
        this.repo = repo;
    }

    // Get all blocks
    @GetMapping
    public List<Block> getAllBlocks() {
        return repo.findAll();
    }

    private long roundEndTime = System.currentTimeMillis() + 30000;

    @PostMapping("/reset")
    public void resetBoard() {
        List<Block> all = repo.findAll();

        all.forEach(b -> {
            b.setOwner(null);
            b.setColor(null);
        });

        repo.saveAll(all);

        // RESET TIMER FOR EVERYONE
        roundEndTime = System.currentTimeMillis() + 30000;
    }


    @GetMapping("/round-time")
    public long getRoundEndTime() {
        return roundEndTime;
    }
}

   